import type { ReservoirRow } from '../types';

export async function fromHN(limit = 100): Promise<ReservoirRow[]> {
  const url = new URL('https://hn.algolia.com/api/v1/search');
  url.searchParams.set('tags', 'story');
  url.searchParams.set('hitsPerPage', String(Math.min(100, Math.max(10, limit))));
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  const rows: ReservoirRow[] = [];
  for (const h of data.hits || []) {
    const title = h?.title;
    const urlStr = h?.url || (h?.objectID ? `https://news.ycombinator.com/item?id=${h.objectID}` : null);
    if (!title || !urlStr) continue;
    rows.push({ text: title, url: urlStr, lang: 'en' });
  }
  return rows;
}

