import type { ReservoirRow } from '../types';

export async function fromRSS(feeds?: string[], limitPerFeed = 50): Promise<ReservoirRow[]> {
  const list = (feeds && feeds.length ? feeds : (process.env.RSS_FEEDS || '').split(',').map(s => s.trim()).filter(Boolean));
  const rows: ReservoirRow[] = [];
  for (const feed of list) {
    try {
      const res = await fetch(feed);
      if (!res.ok) continue;
      const xml = await res.text();
      const itemRegex = /<item[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi;
      let m: RegExpExecArray | null;
      let count = 0;
      while ((m = itemRegex.exec(xml)) && count < limitPerFeed) {
        const title = m[1]?.replace(/<[^>]+>/g, '').trim();
        const link = m[2]?.trim();
        if (title && link) {
          rows.push({ text: title, url: link });
          count++;
        }
      }
    } catch {}
  }
  return rows;
}

