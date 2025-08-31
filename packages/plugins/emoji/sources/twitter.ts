import { searchRecentTweets } from "@factory/integrations/twitter";
import { buildOrQueryTerms } from "../query";

export type EmojiTweet = {
  id: string;
  text: string;
  lang?: string;
  created_at?: string;
  likes?: number;
  retweets?: number;
  replies?: number;
  url: string;
  term?: string;
};

export async function fetchEmojiFromTwitter(limit = 10): Promise<EmojiTweet[]> {
  const queryTerms = (process.env.EMOJI_QUERY || "🪿 🥲 🫨").split(/\s+/).filter(Boolean);
  const query = buildOrQueryTerms(queryTerms);
  const tweets = await searchRecentTweets({ query, maxResults: limit });
  const firstEmoji = queryTerms[0] || "🪿";
  return tweets.map((t) => ({
    id: t.id,
    text: t.text,
    lang: t.lang,
    created_at: t.created_at,
    likes: t.public_metrics?.like_count ?? 0,
    retweets: t.public_metrics?.retweet_count ?? 0,
    replies: t.public_metrics?.reply_count ?? 0,
    url: `https://twitter.com/i/web/status/${t.id}`,
    term: firstEmoji
  }));
}
