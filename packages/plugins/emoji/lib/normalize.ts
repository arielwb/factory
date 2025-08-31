import type { TSourceItem } from '@factory/core/ports';
import type { EmojiContextTweet } from './context';
import { clip, scrubPII } from '../util/text';

export function toSourceItems(rows: EmojiContextTweet[]): TSourceItem[] {
  const now = new Date();
  return rows.map((r, i) => ({
    id: `tw:${r.id ?? i}`,
    niche: 'emoji',
    term: r.emoji,
    lang: r.lang || 'en',
    text: clip(scrubPII(r.text || ''), 200),
    sourceUrl: r.url,
    likes: r.metrics?.like_count ?? 0,
    shares: r.metrics?.retweet_count ?? 0,
    comments: r.metrics?.reply_count ?? 0,
    firstSeenAt: r.created_at ? new Date(r.created_at) : now,
    mediaUrl: undefined
  })) as unknown as TSourceItem[];
}

