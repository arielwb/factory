import type { ReservoirRow } from '../types';

export async function fromNews(): Promise<ReservoirRow[]> {
  const feeds = (process.env.NEWS_FEEDS || '').split(',').map(s=>s.trim()).filter(Boolean);
  if (!feeds.length) return [];
  const rows: ReservoirRow[] = [];
  for (const feed of feeds) {
    try {
      const res = await fetch(feed);
      if (!res.ok) continue;
      const xml = await res.text();
      const itemRegex = /<item[\s\S]*?<title>([\s\S]*?)<\/title>[\s\S]*?<link>([\s\S]*?)<\/link>[\s\S]*?<\/item>/gi;
      let m: RegExpExecArray | null; let count=0;
      while ((m = itemRegex.exec(xml)) && count < 50) {
        const title = m[1]?.replace(/<[^>]+>/g, '').trim();
        const link = m[2]?.trim();
        if (title && link) { rows.push({ text: title, url: link }); count++; }
      }
    } catch {}
  }
  return rows;
}

