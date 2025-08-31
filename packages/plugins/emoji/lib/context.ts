import { searchRecentTweets } from '@factory/integrations/twitter';

export type EmojiContextTweet = {
  id: string;
  emoji: string;
  text: string;
  url: string;
  created_at?: string;
  metrics?: { like_count?: number; retweet_count?: number; reply_count?: number };
  lang?: string;
};

export async function fetchContextForEmoji(params: { emoji: string; perEmoji?: number }): Promise<EmojiContextTweet[]> {
  const { emoji, perEmoji = 20 } = params;
  const data = await searchRecentTweets({
    query: `${emoji} -is:retweet (lang:en OR lang:pt)`,
    maxResults: perEmoji
  });
  return data.map(t => ({
    id: t.id,
    emoji,
    text: t.text,
    url: `https://twitter.com/i/web/status/${t.id}`,
    created_at: t.created_at,
    metrics: t.public_metrics,
    lang: t.lang
  }));
}

