import type { Reservoir } from '@factory/core/types';

const EMOJI_REGEX = /\p{Emoji_Presentation}|\p{Extended_Pictographic}/gu;
const EVERGREEN = new Set(['❤️','😂','🤣','😍']);

export type EmojiCandidate = { term: string; emoji: string; score: number; evidence: string[] };

export function extractEmojiCandidates(reservoir: Reservoir, topN = 20): EmojiCandidate[] {
  const counts = new Map<string, { hits: number; urls: Set<string> }>();
  for (const it of reservoir) {
    const found = (it.text.match(EMOJI_REGEX) || []).slice(0, 6);
    for (const e of found) {
      const cur = counts.get(e) ?? { hits: 0, urls: new Set<string>() };
      cur.hits += 1;
      if (it.url) cur.urls.add(it.url);
      counts.set(e, cur);
    }
  }
  const deny = (process.env.EMOJI_DENYLIST || '').split(',').map(s=>s.trim()).filter(Boolean);
  for (const d of deny) counts.delete(d);
  return [...counts.entries()]
    .map(([emoji, v]) => {
      const evergreenPenalty = EVERGREEN.has(emoji) ? 0.8 : 1;
      const base = Math.round(v.hits * evergreenPenalty);
      return { term: `${emoji} emoji meaning`, emoji, score: base, evidence: [...v.urls].slice(0,3) };
    })
    .sort((a,b)=>b.score-a.score)
    .slice(0, topN);
}

