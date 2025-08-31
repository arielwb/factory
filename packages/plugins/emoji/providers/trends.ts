import type { ReservoirRow } from '../types';

// Fetch daily trending searches from Google Trends public endpoint
// Note: This endpoint returns JSON prefixed with )]}', to prevent XSSI.
export async function fromTrends(): Promise<ReservoirRow[]> {
  const geo = process.env.TRENDS_GEO || 'US';
  const hl = process.env.TRENDS_HL || 'en-US';
  const tz = String(process.env.TRENDS_TZ || '0');
  const url = new URL('https://trends.google.com/trends/api/dailytrends');
  url.searchParams.set('hl', hl);
  url.searchParams.set('tz', tz);
  url.searchParams.set('geo', geo);
  try {
    const res = await fetch(url.toString());
    if (!res.ok) return [];
    const text = await res.text();
    const jsonStr = text.replace(/^\)\]\}',?\s*/, '');
    const data = JSON.parse(jsonStr);
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
  } catch {
    return [];
  }
}
