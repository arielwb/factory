import { searchRecentTweetsPage } from '@factory/integrations/twitter';
import { extractEmojis, COMMON_STOPLIST } from '../util/emoji';
import { getEmojiLRU, setEmojiLRU } from '../store/emojiCache';

export async function discoverTopEmojis(params: { live: boolean; samplePages?: number; samplePageSize?: number }): Promise<{ emoji: string; freq: number; score: number }[]> {
  const { live, samplePages = 5, samplePageSize = 100 } = params;
  if (!live) {
    // Use fixtures to simulate discovery in dev
    const fixtures = await import('../fixtures.json').then(m => m.default as Array<{ text: string; term?: string }>);
    const counts = new Map<string, number>();
    for (const f of fixtures) {
      const emos = extractEmojis(f.text || f.term || '');
      for (const e of emos) counts.set(e, (counts.get(e) ?? 0) + 1);
    }
    const scored = [...counts.entries()].map(([emoji, freq]) => ({ emoji, freq, score: freq }));
    scored.sort((a,b)=> b.score - a.score);
    return scored;
  }

  const counts = new Map<string, number>();
  let tweetsProcessed = 0;
  let pagesUsed = 0;
  let nextToken: string | undefined;
  for (let i = 0; i < samplePages; i++) {
    const { data, meta } = await searchRecentTweetsPage({
      query: '(lang:en OR lang:pt) -is:retweet has:mentions',
      maxResults: samplePageSize,
      nextToken
    });
    nextToken = meta?.next_token;
    pagesUsed++;
    tweetsProcessed += data.length;
    for (const t of data) {
      for (const e of extractEmojis(t.text || '')) {
        if (COMMON_STOPLIST.has(e)) continue;
        counts.set(e, (counts.get(e) ?? 0) + 1);
      }
    }
    if (!nextToken) break;
  }

  const now = Date.now();
  const scored = await Promise.all(
    [...counts.entries()].map(async ([emoji, freq]) => {
      const last = await getEmojiLRU(emoji);
      const novelty = last ? Math.exp(-(now - last) / (7 * 24 * 3600 * 1000)) : 0; // 7-day decay
      const score = freq * (1 - novelty);
      return { emoji, freq, score };
    })
  );
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 20);
  for (const e of top) await setEmojiLRU(e.emoji, now);
  const previewCount = Math.min(top.length, 10);
  const preview = top.slice(0, previewCount).map(e => `${e.emoji}(${e.freq})`).join(' ');
  // concise run summary for tuning parameters
  console.log(`[emoji:discover] pages=${pagesUsed}/${samplePages} pageSize=${samplePageSize} tweets=${tweetsProcessed} unique=${counts.size} top=${preview}`);
  return top;
}

export async function topEmojisFromReservoir(rows: Array<{ text: string }>): Promise<{ emoji: string; freq: number; score: number }[]> {
  const counts = new Map<string, number>();
  for (const r of rows) {
    for (const e of extractEmojis(r.text || '')) {
      if (COMMON_STOPLIST.has(e)) continue;
      counts.set(e, (counts.get(e) ?? 0) + 1);
    }
  }
  // Apply optional denylist from env
  const deny = (process.env.EMOJI_DENYLIST || '').split(',').map(s=>s.trim()).filter(Boolean);
  for (const d of deny) counts.delete(d);
  const now = Date.now();
  const scored = await Promise.all(
    [...counts.entries()].map(async ([emoji, freq]) => {
      const last = await getEmojiLRU(emoji);
      const novelty = last ? Math.exp(-(now - last) / (7 * 24 * 3600 * 1000)) : 0;
      const score = freq * (1 - novelty);
      return { emoji, freq, score };
    })
  );
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 20);
  for (const e of top) await setEmojiLRU(e.emoji, now);
  const preview = top.slice(0, Math.min(10, top.length)).map(e => `${e.emoji}(${e.freq})`).join(' ');
  console.log(`[emoji:discover:nonx] rows=${rows.length} unique=${counts.size} top=${preview}`);
  return top;
}
