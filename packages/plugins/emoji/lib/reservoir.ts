import type { ReservoirRow, DiscoveryItem, Provider } from '../types';
import { fromReddit } from '../providers/reddit';
import { fromHN } from '../providers/hn';
import { fromTrends } from '../providers/trends';
import { fromYouTube } from '../providers/youtube';
import { fromRSS } from '../providers/rss';
import { fromNews } from '../providers/news';
import { withCacheTTL, writeHealth } from './cache';
import { dedupeByUrlAndSimilarity, normalizeText, retry, runLimited, filterByDenylist } from './utils';
import { RequestBudget } from '@factory/factory/util/budget';
import { Breaker } from '@factory/factory/util/breaker';

const registry: Record<string, Provider> = {
  reddit: { name: 'reddit', fetch: async ({ limit }) => (await fromReddit(undefined, limit || 100)).map(toItem('reddit')) },
  hn: { name: 'hn', fetch: async ({ limit }) => (await fromHN(limit || 100)).map(toItem('hn')) },
  trends: { name: 'trends', fetch: async () => (await fromTrends()).map(toItem('trends')) },
  youtube: { name: 'youtube', fetch: async () => (await fromYouTube()).map(toItem('youtube')) },
  rss: { name: 'rss', fetch: async () => (await fromRSS()).map(toItem('rss')) },
  news: { name: 'news', fetch: async () => (await fromNews()).map(toItem('news')) }
};

function toItem(source: string) {
  return (r: ReservoirRow): DiscoveryItem => ({
    id: r.url,
    text: normalizeText(r.text),
    lang: r.lang,
    source,
    url: r.url,
    ts: r.created_at
  });
}

export async function buildReservoir(limit = 300): Promise<ReservoirRow[]> {
  const configured = (process.env.DISCOVER_PROVIDERS || 'reddit,hn').split(',').map(s => s.trim()).filter(Boolean);
  const perProvider = Math.max(10, Number(process.env.RESERVOIR_LIMIT_PER_PROVIDER || 100));
  const ttlHours = Math.max(1, Number(process.env.RESERVOIR_TTL_HOURS || 24));
  const key = `reservoir-${new Date().toISOString().slice(0,10)}.json`;
  const effTtl = process.env.RESERVOIR_NOCACHE === 'true' ? 0 : ttlHours;

  const cached = await withCacheTTL<DiscoveryItem[] | null>(key, effTtl, async () => {
    const jobs = configured.map((name) => async () => {
      const prov = registry[name];
      if (!prov) return [] as DiscoveryItem[];
      const t0 = Date.now();
      try {
        const breaker = new Breaker(Number(process.env.PROVIDER_BREAKER_THRESHOLD || 3));
        const items = await breaker.run(name, () => retry(() => prov.fetch({ limit: perProvider }), 3, 400));
        const arr = items || [];
        await writeHealth(prov.name, { ok: true, count: arr.length, ms: Date.now() - t0 });
        console.log(`[provider:${prov.name}] OK count=${arr.length} ms=${Date.now() - t0}`);
        return arr;
      } catch (e: any) {
        await writeHealth(prov.name, { ok: false, error: e?.message || String(e) });
        console.warn(`[provider:${prov.name}] ERR ${e?.message || e}`);
        return [] as DiscoveryItem[];
      }
    });
    const conc = Math.max(1, Number(process.env.PROVIDERS_CONCURRENCY || 3));
    const arrays = await runLimited(jobs, conc);
    const flat = arrays.flat();
    const budget = new RequestBudget(configured.length * perProvider, 'reservoir');
    const out: DiscoveryItem[] = [];
    for (const it of flat) {
      try { budget.consume(1); out.push(it); } catch { break; }
    }
    return out;
  });

  const deny = process.env.PROFANITY_DENYLIST;
  const normalized: ReservoirRow[] = (cached || [])
    .map((d) => ({ text: d.text, url: d.url, lang: d.lang, created_at: d.ts }))
    .filter(r => filterByDenylist(r.text || '', deny));
  const deduped = dedupeByUrlAndSimilarity(normalized, 0.92);
  const limited = deduped.slice(0, limit);
  console.log(`[emoji:reservoir] providers=${configured.join('+')} rows=${limited.length}`);
  return limited;
}
