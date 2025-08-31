import type { ReservoirRow } from '../types';
import { withCacheTTL } from '../lib/cache';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';

const HL = process.env.TRENDS_HL || 'en-US';
const TZ = String(process.env.TRENDS_TZ || '0');

function stripXssi(s: string) { return s.replace(/^\)\]\}',?\s*/, ''); }
function seedFile(seed: string, geo: string, window: string) {
  const safe = seed.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  const key = `trends/${safe}-${geo}-${window}-${new Date().toISOString().slice(0,10)}.json`;
  return key;
}

async function getRelatedQueries(seed: string, geo: string, time: string, ttlHours: number): Promise<any> {
  const key = seedFile(seed, geo, time);
  const effectiveTTL = process.env.TRENDS_NOCACHE === 'true' ? 0 : ttlHours;
  const headers: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept': '*/*'
  };
  return withCacheTTL<any>(key, effectiveTTL, async () => {
    const reqObj = { comparisonItem: [{ keyword: seed, geo: geo === 'WORLDWIDE' ? '' : geo, time }], category: 0, property: '' };
    const explore = new URL('https://trends.google.com/trends/api/explore');
    explore.searchParams.set('hl', HL);
    explore.searchParams.set('tz', TZ);
    explore.searchParams.set('req', JSON.stringify(reqObj));
    const er = await fetch(explore.toString(), { headers } as any);
    if (!er.ok) throw new Error(`explore ${er.status}`);
    const ejson = JSON.parse(stripXssi(await er.text()));
    const widget = (ejson.widgets || []).find((w: any) => (w.id === 'RELATED_QUERIES' || /RELATED_QUERIES/i.test(w.title || '')));
    if (!widget) return { top: [], rising: [] };
    const rq = new URL('https://trends.google.com/trends/api/widgetdata/relatedsearches');
    rq.searchParams.set('hl', HL);
    rq.searchParams.set('tz', TZ);
    rq.searchParams.set('req', JSON.stringify(widget.request));
    rq.searchParams.set('token', String(widget.token));
    const rr = await fetch(rq.toString(), { headers } as any);
    if (!rr.ok) throw new Error(`related ${rr.status}`);
    const txt = await rr.text();
    const rjson = JSON.parse(stripXssi(txt));
    // Expected shape: { default: { rankedList: [ { rankedKeyword: [...] }, { rankedKeyword: [...] } ] } }
    return rjson?.default || { rankedList: [] };
  });
}

async function dailyTrendsRows(geo: string): Promise<ReservoirRow[]> {
  const url = new URL('https://trends.google.com/trends/api/dailytrends');
  url.searchParams.set('hl', HL);
  url.searchParams.set('tz', TZ);
  url.searchParams.set('geo', geo === 'WORLDWIDE' ? 'US' : geo);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const text = await res.text();
    const data = JSON.parse(stripXssi(text));
    const days = data?.default?.trendingSearchesDays || [];
    const rows: ReservoirRow[] = [];
    for (const day of days) {
      const date = day?.date || '';
      for (const item of day?.trendingSearches || []) {
        const query: string = item?.title?.query;
        const article: string | undefined = item?.articles?.[0]?.url;
        if (!query) continue;
        rows.push({ text: query, url: article || `https://www.google.com/search?q=${encodeURIComponent(query)}`, created_at: date });
      }
    }
    return rows;
  } catch { return []; }
}

function toRows(list: any[]): ReservoirRow[] {
  const out: ReservoirRow[] = [];
  for (const rk of list || []) {
    const kw = rk?.rankedKeyword || [];
    for (const k of kw) {
      const q = String(k?.query || '').trim();
      if (!q) continue;
      out.push({ text: q, url: `https://www.google.com/search?q=${encodeURIComponent(q)}`, lang: 'en' });
    }
  }
  return out;
}

// Trends provider (EN seeds): related top + rising queries per seed
export async function fromTrends(): Promise<ReservoirRow[]> {
  const seeds = (process.env.TRENDS_SEEDS_EN || '').split(',').map(s => s.trim()).filter(Boolean);
  const geo = process.env.TRENDS_GEO || 'WORLDWIDE';
  const windowStr = process.env.TRENDS_TIMEWINDOW || 'now 7-d';
  const ttl = Math.max(1, Number(process.env.TRENDS_CACHE_TTL_HOURS || 24));

  if (seeds.length === 0) {
    // Fallback: daily trends when no seeds configured
    return dailyTrendsRows(geo);
  }

  // Seeded related queries path
  const maxPerSeed = 20;
  const all: ReservoirRow[] = [];
  // Trends state (watchlist)
  const stateFile = resolve(process.cwd(), 'data/fixtures/trends_state.json');
  let state: any = { watchlist: [], lastSeen: {}, seenScores: {} };
  try { state = JSON.parse(await fs.readFile(stateFile, 'utf8')); } catch {}
  const maxPromoted = Math.max(1, Number(process.env.TRENDS_MAX_PROMOTED || 20));
  const minGrowth = Math.max(0, Number(process.env.TRENDS_MIN_GROWTH || 50));

  for (const seed of seeds) {
    try {
      const data = await getRelatedQueries(seed, geo, windowStr, ttl);
      const topRows = toRows(data?.rankedList || data?.top || []);
      const risingRows = toRows(data?.rankedList?.slice(1) || data?.rising || []);
      const before = all.length;
      all.push(...topRows.slice(0, maxPerSeed));
      all.push(...risingRows.slice(0, maxPerSeed));
      const added = all.length - before;
      if (process.env.TRENDS_DEBUG === 'true') {
        console.log(`[trends] seed="${seed}" added=${added} (top=${topRows.length}, rising=${risingRows.length})`);
      }

      // Promotion logic using rising values if present
      const rk = (data?.rankedList?.slice(1)?.[0]?.rankedKeyword) || [];
      for (const k of rk) {
        const query = String(k?.query || '').trim().toLowerCase();
        const score = Number(k?.value || 0);
        if (!query) continue;
        // Intent filters
        const isEmoji = query.includes('emoji') && (query.includes('meaning') || query.includes('what does'));
        const isAcr = /\b[A-Z]{2,5}\b\s+meaning/.test(k?.query || '');
        if (!(isEmoji || isAcr)) continue;
        const hist: number[] = Array.isArray(state.seenScores[query]) ? state.seenScores[query] : [];
        const prev = hist.length ? median(hist) : 0;
        const growth = prev > 0 ? ((score - prev) / Math.max(1, prev)) * 100 : score;
        const promote = growth >= minGrowth || score >= 70;
        const today = new Date().toISOString().slice(0,10);
        state.seenScores[query] = [...hist.slice(-3), score];
        if (promote) {
          if (!state.watchlist.includes(query)) state.watchlist.push(query);
          state.lastSeen[query] = today;
        }
      }
    } catch (e) {
      // ignore seed fetch error
    }
  }

  // If nothing found from seeds, fallback to daily trends so provider health isn't zero
  if (all.length === 0) {
    if (process.env.TRENDS_DEBUG === 'true') console.log('[trends] seeds yielded 0; falling back to daily trends');
    all.push(...await dailyTrendsRows(geo));
  }

  // Cap watchlist size
  if (state.watchlist.length > maxPromoted) {
    state.watchlist = state.watchlist.slice(-maxPromoted);
  }
  try { await fs.mkdir(dirname(stateFile), { recursive: true }); await fs.writeFile(stateFile, JSON.stringify(state, null, 2), 'utf8'); } catch {}

  return all;
}

function median(arr: number[]): number {
  if (!arr.length) return 0;
  const a = [...arr].sort((x,y)=>x-y); const m = Math.floor(a.length/2);
  return a.length % 2 ? a[m] : (a[m-1] + a[m]) / 2;
}
