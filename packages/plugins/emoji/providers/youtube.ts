import type { ReservoirRow } from '../types';

export async function fromYouTube(query?: string, maxResults?: number): Promise<ReservoirRow[]> {
  const key = process.env.YT_API_KEY;
  if (!key) return [];
  const q = (query || process.env.YT_QUERY || 'emoji meaning').toString();
  const limit = Math.min(50, Math.max(1, Number(maxResults ?? process.env.YT_MAX_RESULTS ?? 25)));
  const url = new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part', 'snippet');
  url.searchParams.set('maxResults', String(limit));
  url.searchParams.set('q', q);
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
