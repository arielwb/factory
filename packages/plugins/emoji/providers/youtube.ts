import type { ReservoirRow } from '../types';

export async function fromYouTube(query = 'emoji meaning', maxResults = 25): Promise<ReservoirRow[]> {
  const key = process.env.YT_API_KEY;
  if (!key) return [];
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', String(Math.min(50, Math.max(1, maxResults))));
  url.searchParams.set('q', query);
  url.searchParams.set('key', key);
  const res = await fetch(url.toString());
  if (!res.ok) return [];
  const data = await res.json();
  const rows: ReservoirRow[] = [];
  for (const item of data.items || []) {
    const title = item?.snippet?.title as string;
    const videoId = item?.id?.videoId as string;
    if (!title || !videoId) continue;
    rows.push({ text: title, url: `https://www.youtube.com/watch?v=${videoId}`, lang: item?.snippet?.defaultLanguage || 'und' });
  }
  return rows;
}

