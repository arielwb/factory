erfect—let’s turn the emoji scraper from “search hard-coded emojis” into a two-stage pipeline that (A) discovers which emojis are trending, then (B) fetches context for those winners. Same plugin interface, factory stays ignorant of Twitter details.

What “upgraded” means

Discovery, not lookup: find emojis that are actually spiking now.

Context, not feeds: pull a handful of representative public tweets per emoji.

Normalized output: always return SourceItem[] to the factory.

Stage A — Discovery (find candidate emojis)

You have three practical discovery strategies. You can ship any one; implementing two gives resilience.

A1) Wide recent search (cheap & simple)

Query very broad tokens that appear in lots of tweets, e.g. one common emoji or generic term, to get a random-ish sample of tweets from the last ~24h, then mine for emojis locally.

Endpoint: GET /2/tweets/search/recent

Query: something always present (e.g., a space " " won’t work; use a benign stoplist like -is:retweet lang:en OR lang:pt has:mentions or a common emoji like 🙂 as bait)

Pull 200–1000 tweets (paged), extract all emoji with a Unicode regex, count frequency, keep top N.

Pros: dead simple.
Cons: not perfectly representative (but good enough for MVP).

A2) Trends → seed queries → mine results

Use places/trends (if available to you) or a set of trending hashtags/keywords, then for each trend term run one “recent” search, mine emojis from those results, aggregate counts.

Pros: biased toward what’s “hot.”
Cons: requires trends access; still needs your own emoji mining.

A3) Sample stream (best fidelity, more plumbing)

Connect to a filtered stream using very light rules (or sample if available), process a few minutes of tweets, mine emojis, rank.

Pros: best live signal.
Cons: streaming infra, quotas.

Recommendation for MVP: implement A1 (wide recent search) first; add A2 later.

Discovery algorithm (language-agnostic)

Fetch K pages of recent tweets (respect rate limits).

Extract emojis per tweet with a robust regex (/\p{Emoji_Presentation}|\p{Extended_Pictographic}/u, plus joiner sequences handling).

Count frequency per distinct emoji.

Filter with a stoplist (✌️, ❤️, 😂 are always high; deprioritize if you want “novelty”).

Pick top N not seen recently (use a per-emoji LRU cache).

Return a list of { term: "🪿", count, sampleTweetIds[] } to feed Stage B.

Novelty boost: keep a table emoji_seen(term, last_seen_at). Score = freq * decay(last_seen_at).

Stage B — Context (fetch representative tweets for each emoji)

For each discovered emoji (say top 3–10):

Run search/recent with query=🪿 -is:retweet lang:(en OR pt) and max_results=20–50.

Pick 3–5 tweets with best engagement or diversity (different authors).

Normalize to SourceItem:

id: stable hash like tw:${tweet.id}

term: the emoji itself

text: clipped tweet text (≤200 chars, PII scrubbed)

sourceUrl: https://twitter.com/i/web/status/${id}

likes/shares/comments: from metrics (0 if absent)

firstSeenAt: tweet.created_at

lang: tweet.lang (fallback to detected)

mediaUrl: first image/video URL if present (optional)

TypeScript sketch (plugin stays dumb; factory calls it)
// packages/plugins/emoji/index.ts
import { NichePlugin } from "@factory/core/plugins";
import { discoverTopEmojis } from "./lib/discover";
import { fetchContextForEmoji } from "./lib/context";
import { toSourceItems } from "./lib/normalize";

export const emojiPlugin: NichePlugin = {
  name: "emoji",

  async discover({ limit = 5, live }) {
    const top = await discoverTopEmojis({ live, samplePages: 5, samplePageSize: 100 });
    const picked = top.slice(0, limit);

    const batches = await Promise.all(
      picked.map(e => fetchContextForEmoji({ emoji: e.emoji, perEmoji: 20 }))
    );

    return toSourceItems(batches.flat());
  },

  scoreHint(item) {
    // Slight bonus for single-codepoint emoji; demote always-hot hearts/crying-laughing
    const hot = new Set(["❤️","😂","🤣","😍"]);
    const single = [...item.term].length === 1 ? 0.2 : 0;
    const demote = hot.has(item.term) ? -0.2 : 0;
    return single + demote;
  },

  buildPrompt({ item }) {
    return {
      system: "You write concise explainers with sections: meaning, origin, usage (2), variants, notes. Output strict JSON per schema.",
      user: JSON.stringify({
        niche: "emoji",
        term: item.term,
        snippets: [item.text],
        sources: [item.sourceUrl],
        language: item.lang
      })
    };
  },

  slugFor(item) {
    // Better: map "🪿" -> "goose-emoji"
    return `what-does-${labelEmoji(item.term)}-mean`;
  }
};

discoverTopEmojis (A1: wide search)
// packages/plugins/emoji/lib/discover.ts
import { searchRecentTweets } from "../twitter";
import { extractEmojis } from "../util/emoji";
import { getEmojiLRU, setEmojiLRU } from "../store/emojiCache";

export async function discoverTopEmojis({ live, samplePages = 5, samplePageSize = 100 }){
  const counts = new Map<string, number>();
  if (!live) return mockTop(); // fixture for local dev

  let nextToken: string|undefined;
  for (let i=0; i<samplePages; i++) {
    const res = await searchRecentTweets({
      // a broad query; tweak to your access tier
      query: '(lang:en OR lang:pt) -is:retweet has:mentions',
      maxResults: samplePageSize,
      nextToken
    });
    nextToken = res.meta?.next_token;

    for (const t of res.data ?? []) {
      for (const e of extractEmojis(t.text)) {
        counts.set(e, (counts.get(e) ?? 0) + 1);
      }
    }
    if (!nextToken) break;
  }

  // Convert to sorted array with novelty boost
  const now = Date.now();
  const scored = [...counts.entries()].map(([emoji, freq]) => {
    const last = getEmojiLRU(emoji); // epoch ms or null
    const novelty = last ? Math.exp(-(now - last) / (7*24*3600*1000)) : 0; // decay over 7 days
    const score = freq * (1 - novelty); // prefer unseen/recently unseen
    return { emoji, freq, score };
  });

  scored.sort((a,b)=> b.score - a.score);
  const top = scored.slice(0, 20);
  top.forEach(e => setEmojiLRU(e.emoji, now)); // remember discovery

  return top;
}

fetchContextForEmoji
// packages/plugins/emoji/lib/context.ts
import { searchRecentTweets } from "../twitter";

export async function fetchContextForEmoji({ emoji, perEmoji = 20 }){
  const res = await searchRecentTweets({
    query: `${emoji} -is:retweet (lang:en OR lang:pt)`,
    maxResults: perEmoji
  });

  return (res.data ?? []).map(t => ({
    id: t.id,
    emoji,
    text: t.text,
    url: `https://twitter.com/i/web/status/${t.id}`,
    created_at: t.created_at,
    metrics: t.public_metrics,
    media: t.attachments?.media_keys ?? [],
    lang: t.lang ?? "und"
  }));
}

Normalization to SourceItem
// packages/plugins/emoji/lib/normalize.ts
import type { TSourceItem } from "@factory/core/ports";
import { clip, hashId, scrubPII } from "../util/text";

export function toSourceItems(rows: any[]): TSourceItem[] {
  return rows.map(r => ({
    id: `tw:${r.id}`,
    niche: "emoji",
    term: r.emoji,
    lang: r.lang || "und",
    text: clip(scrubPII(r.text), 200),
    sourceUrl: r.url,
    likes: r.metrics?.like_count ?? 0,
    shares: r.metrics?.retweet_count ?? 0,
    comments: r.metrics?.reply_count ?? 0,
    firstSeenAt: new Date(r.created_at),
    mediaUrl: undefined
  }));
}

Operational guardrails

Caching: wrap both discovery and context fetches with withCache("emoji-discovery.json", fn) so local runs don’t burn quota.

Rate limits: exponential backoff on 429; respect x-rate-limit-remaining.

Safety: scrub emails/phones from text; add a profanity flag; don’t store full tweet objects—only derived fields you need.

Dedupe: key by term+sourceUrl; skip items already in DB or seen in last N days.

Language split: keep lang to route EN/PT explainers; you can later prefer PT if that aligns with your brand.

Migration from your current hard-coded query

Today: EMOJI_QUERY="🪿 🥲 🫨" → lookup tweets → items.

Upgrade: call discoverTopEmojis() first; it returns [ "🫨", "🪿", "🥲", … ]. Feed that list into your existing lookup function (Stage B). You retain your existing code—just move the hard-coded list into discovery output.

No factory changes, no site changes. Only the emoji plugin grows a discovery step before it calls your existing context search.

Success criteria (concrete)

A local run produces N ≥ 3 novel emojis without specifying any explicit emoji in env.

For each discovered emoji, the plugin returns ≥ 3 normalized SourceItems.

End-to-end pipeline (generate → render → publish) works with the new plugin output without edits to the factory.

With caching ON, a second run does zero network calls and produces identical SourceItem[].

With caching OFF, runs respect rate limits and log backoff events.

# Addendum - quotas

Great catch. You don’t want each plugin independently hammering X/Twitter. The right mental model is:

One shared “Tweet Reservoir” → a tiny number of recent-search (or stream) pulls per day that all plugins reuse.

Plugins mine the same reservoir for different signals (emoji, acronyms, memes, “why” questions).

Context lookups are rationed (only for the few winners per day), cached, and re-used.

That way discovery is O(1) requests per day (constant), not O(#plugins).

How we’ll structure it

adapters/twitter/source.ts

getSampleTweets({live, pages, pageSize}) → returns a de-duped list of recent public tweets (IDs + text + basic metrics). All plugins call this, never the API directly.

Internally uses a single query (or two language-specific queries), with caching to data/fixtures/twitter-sample-YYYY-MM-DD.json.

Plugins:

Emoji: parse reservoir → top-k emojis.

Acronyms: parse reservoir → ALLCAPS tokens.

Memes/phrases: parse reservoir → regex on patterns (“why do/does…”, “is … down”).

Context fetch (per winning term):

searchRecentTweets({query, maxResults}) only for the top few winners (e.g., 2–5/day total), then cache results.

Request budgeting (conservative)

Let’s assume:

Reservoir search: up to 100 tweets per request.

Context search: up to 50 tweets per request.

30-day month.

We’ll run three modes. You can pick one and cap in config.

1) Ultra-lean (proof of life)

Reservoir: 2 requests/day (2×100 ≈ 200 tweets sample)

Winners: 3/day (2 emoji + 1 acronym)

Context: 1 request per winner (3/day)

Daily total: 2 + 3 = 5

Monthly total: ~150 requests

2) Standard (safe for free tiers)

Reservoir: 4 requests/day (≈ 400 tweets sample)

Winners: 5/day (3 emoji + 2 acronyms/memes)

Context: 1 request per winner (5/day)

Daily total: 4 + 5 = 9

Monthly total: ~270 requests

3) Aggressive (still modest)

Reservoir: 8 requests/day (≈ 800 tweets sample)

Winners: 8/day (mixed)

Context: 1–2 requests per winner (avg 1.5 → 12/day)

Daily total: 8 + 12 = 20

Monthly total: ~600 requests

Actual quotas depend on your access tier and settings. The architecture above is designed to stay well below “small free” thresholds by default and to degrade gracefully if limits are lower.

How we keep requests low (and predictable)

Centralized reservoir: one shared sample feeds all plugins. Discovery cost does not grow with plugins.

Hard caps: per-run and per-day caps (e.g., MAX_DISCOVERY_REQ=4, MAX_CONTEXT_REQ=5). If exceeded, we skip/queue for tomorrow.

Caching:

Cache reservoir files daily (JSON). Re-run = 0 API calls.

Cache context results per term (e.g., emoji-🪿-2025-08-30.json).

Rationing:

Only fetch context for top-k terms by score/novelty.

Backfill context tomorrow if you hit the cap today (queue).

Hydration-on-demand:

Store tweet IDs in DB; hydrate full text only when generating an explainer, not at discovery time.

Multi-signal mining:

Extract emoji, acronyms, phrases in one pass over the reservoir (single loop).

Staggering:

Run reservoir pulls at off-peak times (once morning, once evening) to spread calls and capture different vibes.

Where trends fit in

If your access level includes trends:

Pull trending terms (1 request) → use those terms to seed the reservoir search (still a handful of requests).

Do not call trends per plugin; just once, then reuse.

“Single pipe” code outline (so Codex won’t fan out calls)
// adapters/twitter/source.ts
export async function buildTweetReservoir({live, pages=4, pageSize=100}) {
  // withCache("reservoir-YYYY-MM-DD.json", async () => {
  //   loop pages: searchRecentTweets(QUERY_BASE, {maxResults: pageSize})
  //   collect: { id, text, lang, metrics, created_at }
  //   dedupe by id
  //   return array
  // });
}

export async function discoverSignalsFromReservoir(reservoir) {
  return {
    emojis: extractTopEmojis(reservoir, {topK: 5}),
    acronyms: extractTopAcronyms(reservoir, {topK: 5}),
    whyQuestions: extractWhyQuestions(reservoir, {topK: 5})
  };
}


Plugins call:

const reservoir = await buildTweetReservoir({ live, pages: CFG.RESERVOIR_PAGES });
const { emojis } = await discoverSignalsFromReservoir(reservoir);
const winners = emojis.slice(0, CFG.TOPK);
for (const e of winners) {
  await contextBudget.consume(1); // throws if over daily cap
  const ctx = await fetchContextForEmoji(e, CFG.CONTEXT_RESULTS);
  yield toSourceItems(ctx);
}

Practical tips to stretch the quota

Mix sources: let Reddit/RSS/Google Trends carry some niches (acronyms, “is it down”), using Twitter only for emoji/phrase coloration.

Daily budget dashboard: show “Calls used / Calls allowed” in your admin so you (and future you) know when you’re nearing limits.

Fallbacks: if reservoir is empty (quota hit), fall back to yesterday’s reservoir for discovery; queue context fetches for tomorrow.

Batch days: run discovery Mon/Wed/Fri; re-use reservoir Tue/Thu for generation and social.

Bottom line

Yes, the plan reuses the same small set of Twitter requests for all plugins via a shared reservoir.

With caps and caching, you’re looking at ~150–600 requests/month, depending on mode—not per plugin, total.

The factory remains the same; only the Twitter adapter enforces budgets and caching. If a quota crunch hits, everything still works off cached data and other sources.