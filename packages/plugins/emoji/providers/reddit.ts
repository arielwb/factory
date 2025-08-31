import type { ReservoirRow } from '../types';

export async function fromReddit(subs?: string[], limitPerSub = 50): Promise<ReservoirRow[]> {
  const list = (subs && subs.length ? subs : (process.env.REDDIT_SUBS || 'brasil,ProgrammerHumor,explainlikeimfive').split(',').map(s => s.trim()).filter(Boolean));
  const rows: ReservoirRow[] = [];
  for (const sub of list) {
    const url = new URL(`https://www.reddit.com/r/${encodeURIComponent(sub)}/hot.json`);
    url.searchParams.set('limit', String(Math.min(100, Math.max(1, limitPerSub))));
    const res = await fetch(url.toString(), { headers: { 'User-Agent': 'factory/0.1' } } as any);
    if (!res.ok) continue;
    const data = await res.json();
    for (const child of data.data?.children || []) {
      const d = child.data;
      const title: string = d?.title || '';
      const permalink: string = d?.permalink || '';
      if (!title || !permalink) continue;
      rows.push({ text: title, url: `https://www.reddit.com${permalink}`, lang: 'en', created_at: d?.created_utc ? new Date(d.created_utc * 1000).toISOString() : undefined });
    }
  }
  return rows;
}

