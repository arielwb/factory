📝 Updated RUNBOOK (with Scraping Step)
Local-first Pipeline

Ingest (scraping) → gather trending items (emoji, acronyms, memes, etc.).

Generate (LLM) → turn items into drafts.

Render → OG image.

Publish → save post in DB + serve in site.

Distribute → mock poster logs “would post” payloads.

Step 0: Ingest Fixtures (for first smoke test)

You already have /packages/ingest/emoji.mock.ts. This returns a hard-coded emoji source item so you can test the pipeline before touching the internet. ✅

Step 1: Local Scraper

Add /packages/ingest/emoji.twitter.ts:

import { TSourceItem } from "@factory/core/ports";
import fetch from "node-fetch";

export async function fetchTrendingEmojisTwitter(): Promise<TSourceItem[]> {
  // For MVP: hit Twitter’s *unofficial* trending endpoint via API v2 (requires BEARER_TOKEN)
  const res = await fetch("https://api.twitter.com/2/tweets/search/recent?query=%F0%9F%90%9F&max_results=10", {
    headers: { "Authorization": `Bearer ${process.env.TWITTER_BEARER!}` }
  });
  const data = await res.json();

  const now = new Date();
  return (data.data || []).map((tweet: any, i: number) => ({
    id: `tw:${tweet.id}`,
    niche: "emoji",
    term: "🪿", // Goose emoji, hard-coded for POC
    lang: tweet.lang || "en",
    text: tweet.text,
    sourceUrl: `https://twitter.com/i/web/status/${tweet.id}`,
    likes: 0,
    shares: 0,
    comments: 0,
    firstSeenAt: now
  }));
}


Local smoke test:

pnpm ts-node -e "require('./packages/ingest/emoji.twitter').fetchTrendingEmojisTwitter().then(console.log)"


You should see an array of SourceItem objects.

Step 2: Integrate Scraper into Worker

In apps/worker/index.ts, swap the mock ingest for a real one with an env flag:

import { fetchTrendingEmojiMock } from "@factory/ingest/emoji.mock";
import { fetchTrendingEmojisTwitter } from "@factory/ingest/emoji.twitter";

const useLive = process.env.INGEST_DRIVER === "twitter";

const items = useLive
  ? await fetchTrendingEmojisTwitter()
  : fetchTrendingEmojiMock();


Run locally:

INGEST_DRIVER=twitter TWITTER_BEARER=xxx pnpm ts-node apps/worker/index.ts

Step 3: Expand Scrapers (Optional)

Acronyms: pull trending words from Twitter, Reddit, or Google Trends (use the Trends API or scrape RSS).

Portuguese memes: scrape Reddit /r/brasil, TikTok hashtags, or seed with a JSON file.

Biology Q&A: pull from Reddit /r/askscience, StackExchange Biology, or CSV of FAQs.

Each scraper just needs to return an array of TSourceItem.

Step 4: Fixture Mode (for repeatable dev)

Add caching so every scrape is stored in JSON locally:

import { promises as fs } from "fs";
import * as path from "path";

async function withCache<T>(filename: string, fn: () => Promise<T>): Promise<T> {
  const file = path.resolve("data/fixtures", filename);
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    const fresh = await fn();
    await fs.writeFile(file, JSON.stringify(fresh, null, 2));
    return fresh;
  }
}


Now in your scraper:

export const fetchTrendingEmojisTwitterCached = () =>
  withCache("emoji-twitter.json", fetchTrendingEmojisTwitter);


So local dev doesn’t hammer APIs.

Success Criteria (Scraping)

pnpm ingest:emoji --mock → returns 1–3 dummy items.

pnpm ingest:emoji --live (with env creds) → returns ≥5 real items from Twitter.

Output validated against TSourceItem schema with Zod.

Cached fixtures stored in data/fixtures/emoji-twitter.json for repeatable runs.