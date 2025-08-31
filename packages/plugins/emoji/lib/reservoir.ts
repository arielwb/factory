import type { ReservoirRow } from '../types';
import { fromReddit } from '../providers/reddit';
import { fromHN } from '../providers/hn';
import { fromTrends } from '../providers/trends';
import { fromYouTube } from '../providers/youtube';
import { fromRSS } from '../providers/rss';

export async function buildReservoir(limit = 300): Promise<ReservoirRow[]> {
  const configured = (process.env.DISCOVER_PROVIDERS || 'reddit,hn').split(',').map(s => s.trim()).filter(Boolean);
  const tasks: Array<Promise<ReservoirRow[]>> = [];
  for (const p of configured) {
    switch (p) {
      case 'reddit': tasks.push(fromReddit(undefined, 100)); break;
      case 'hn': tasks.push(fromHN(100)); break;
      case 'trends': tasks.push(fromTrends()); break;
      case 'youtube': tasks.push(fromYouTube()); break;
      case 'rss': tasks.push(fromRSS()); break;
      default: break;
    }
  }
  const results = await Promise.allSettled(tasks);
  const rows: ReservoirRow[] = [];
  for (const r of results) {
    if (r.status === 'fulfilled') rows.push(...r.value);
  }
  // Dedupe by URL
  const seen = new Set<string>();
  const out: ReservoirRow[] = [];
  for (const row of rows) {
    if (seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
    if (out.length >= limit) break;
  }
  console.log(`[emoji:reservoir] providers=${configured.join('+')} rows=${out.length}`);
  return out;
}

