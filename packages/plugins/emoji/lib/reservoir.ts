import type { ReservoirRow, DiscoveryItem, Provider } from '../types';
import { fromReddit } from '../providers/reddit';
import { fromHN } from '../providers/hn';
import { fromTrends } from '../providers/trends';
import { fromYouTube } from '../providers/youtube';
import { fromRSS } from '../providers/rss';
import { withCacheTTL, writeHealth } from './cache';
import { dedupeByUrlAndSimilarity, normalizeText, retry } from './utils';

const registry: Record<string, Provider> = {
  reddit: { name: 'reddit', fetch: async ({ limit }) => (await fromReddit(undefined, limit || 100)).map(toItem('reddit')) },
  hn: { name: 'hn', fetch: async ({ limit }) => (await fromHN(limit || 100)).map(toItem('hn')) },
  trends: { name: 'trends', fetch: async () => (await fromTrends()).map(toItem('trends')) },
  youtube: { name: 'youtube', fetch: async () => (await fromYouTube()).map(toItem('youtube')) },
  rss: { name: 'rss', fetch: async () => (await fromRSS()).map(toItem('rss')) }
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

  const cached = await withCacheTTL<DiscoveryItem[] | null>(key, ttlHours, async () => {
    const out: DiscoveryItem[] = [];
    for (const name of configured) {
      const prov = registry[name];
      if (!prov) continue;
      const t0 = Date.now();
      try {
        const items = await retry(() => prov.fetch({ limit: perProvider }), 3, 400);
        out.push(...items);
        await writeHealth(prov.name, { ok: true, count: items.length, ms: Date.now() - t0 });
        console.log(`[provider:${prov.name}] OK count=${items.length} ms=${Date.now() - t0}`);
      } catch (e: any) {
        await writeHealth(prov.name, { ok: false, error: e?.message || String(e) });
        console.warn(`[provider:${prov.name}] ERR ${e?.message || e}`);
      }
    }
    return out;
  });

  const normalized: ReservoirRow[] = (cached || []).map((d) => ({ text: d.text, url: d.url, lang: d.lang, created_at: d.ts }));
  const deduped = dedupeByUrlAndSimilarity(normalized, 0.92);
  const limited = deduped.slice(0, limit);
  console.log(`[emoji:reservoir] providers=${configured.join('+')} rows=${limited.length}`);
  return limited;
}
