Short version: my earlier request-count estimates aren’t compatible with X’s read-count quotas. On the Free tier you only get ~100 reads/month (basically one 100-tweet search), so the plan must either (a) avoid X for discovery or (b) move to Basic. On Basic, you get ~10k–15k reads/month (docs vary), which is workable if we budget carefully. 
X Developer
+2
X Developer
+2

Here’s how to translate our pipeline into reads (not “requests”):

A search/recent call with max_results=100 = ~100 reads (not 1).

A “reservoir” pull of 100 tweets = 100 reads.

A “context” pull of 20 tweets for a winner term = 20 reads.

Reality check by tier
Free (write-only focus + tiny read quota)

Read cap: ~100 reads/month. 
X Developer
+1

Conclusion: You cannot do ongoing discovery on X. Use Reddit/RSS/Google Trends for discovery, and save X for a very occasional 1×/month context pull. Otherwise, upgrade.

Basic (paid)

Read cap: docs say 10k reads/month in some places and 15k reads/month in others (X’s pages are inconsistent; treat 10k as the safe floor). 
X Developer
+1

Feasible budget (daily):

Reservoir: 1×100 = 100 reads/day

Context: 5 winners × 20 = 100 reads/day

Daily total: 200 reads → ~6,000/month (well under 10k)

You still get robust discovery (100 tweets/day sample) and 5 fresh explainers/day.

Recommended adjustments to our plan

Single shared reservoir (already proposed): one 100-tweet pull/day that all plugins mine (emojis, acronyms, phrases).

Strict context budget: cap at 5 terms/day, 20 tweets each. Push overflow to next day.

Aggressive caching:

Reservoir cache per day → re-runs cost 0 reads.

Context cache per term/day.

Mix sources: do most discovery via Reddit/RSS/Trends (no X reads), use X only to color a few winners with examples.

Feature flag: run with X_ENABLED=false on Free; flip to true only when you’ve switched to Basic.

What this means for your earlier numbers

My previous “150–600 requests/month” estimate assumed requests were the scarce unit. On X, reads are the scarce unit. If each request returns 100 posts, 150 requests ≈ 15,000 reads—fine on Pro, too high for Basic-10k, impossible on Free. Rebudgeting to reads fixes this.

TL;DR

Free: treat X as effectively off for read-based discovery.

Basic: target ~6k reads/month using the budget above (100 reservoir + 100 context per day).

Our shared-reservoir + caching design still works; we just dial the knobs to fit the tier’s read cap and rely more on non-X sources for discovery until you upgrade.

You said:
upgrading would double the monthly cost of the project
ChatGPT said:
Thought for 26s

Yep—paying for X would nuke your lean budget. The good news: you don’t need it to get lift-off. Reframe X as optional enrichment, not your discovery engine. Here’s how to keep everything zero-cost (or close) and still hit your “factory” goals.

What changes (in one line)

Discovery reservoir = non-X sources.

X/Twitter = off by default (flip on later for context only, with hard read caps).

Zero/low-cost discovery stack (plug into the same plugin interface)

Use these to build the shared “Tweet-like Reservoir,” but without X:

Reddit (free RSS + JSON)

Discovery: subreddit RSS (e.g., /r/brasil, /r/ProgrammerHumor, /r/explainlikeimfive) → parse titles/comments for emojis, acronyms, memes, “why” questions.

Tech: fetch https://www.reddit.com/r/<sub>/hot.json?limit=100 (public JSON), or RSS feeds.

Notes: Don’t scrape full bodies; store minimal snippets + permalinks.

Hacker News API (free)

Discovery: top/new stories + titles/comments → extract programming memes, error codes, acronyms.

Great for the dev niche.

Google Trends (free web → JS libs)

Discovery: regional trends & rising queries → seed terms (emoji names, slang, holiday names).

JS libs exist; worst case, a tiny headless fetch of the trends JSON endpoints.

YouTube Data API (generous free quota)

Discovery: search captions/titles for slang, emoji, “what does X mean”, “is X down”.

Quota: 10k units/day (ample for lightweight discovery).

RSS everywhere

Discovery: tech vendor status pages, language blogs, pop-culture news → spot terms to explain.

Super cheap and surprisingly high-signal.

Own site telemetry (after week 2)

Discovery: Google Search Console queries hitting your pages → mine “People Also Ask,” new long-tail questions → generate new posts.

This becomes your best source over time.

Optional enrichment sources (no quotas): Discord/Slack exports (your own communities), user submissions, CSV drops.

Where X fits (later)

Off by default (X_ENABLED=false).

If/when upgraded, use X for context on 3–5 winners/day only (20 reads each = 60–100 reads/day) and keep the discovery on the free stack. This caps you at ~3k reads/month—safe on Basic, impossible on Free (so keep it off until you pay).

Architecture tweak (clean & future-proof)

Keep the factory + plugin split, but introduce two provider layers inside each plugin:

discoverProviders (free-first): reddit, hn, trends, youtube, rss (→ return SourceItem[]).

enrichProviders (optional): x_context (→ add 2–3 usage snippets).

Config per env:

DISCOVER_PROVIDERS=reddit,hn,trends
ENRICH_PROVIDERS=   // empty in dev/prod-free; set to x_context later
DAILY_CONTEXT_BUDGET=0 // 0 on free, 5 on basic


Factory flow stays the same; only providers change.

What you’ll lose without X (and how to patch it)

Slightly less “real-time” social pulse → offset by Reddit hot + Trends rising queries.

Fewer short, punchy snippets → pull one or two Reddit comment lines or YouTube caption lines instead. The LLM doesn’t care where the snippet came from.

Concrete, low-cost budgets (per day)

Reddit: 3–6 feeds × 100 items = a few GETs → $0.

HN: 1–2 GETs → $0.

Trends: 1–2 calls → $0.

YouTube search: 2–4 searches (≤400 units) → far under 10k/day.

Total: effectively free.

X: 0 reads on Free (keep off). On Basic, ≤100 reads/day reserved for enrichment.

Actionable task list to de-Twitter your MVP (no throwaway code)

Add provider registry (per plugin)

discoverProviders: reddit.ts, hn.ts, trends.ts, youtube.ts, rss.ts (each returns SourceItem[]).

enrichProviders: x_context.ts (returns extra snippets), behind budget gate.

Shared reservoir (non-X)

buildReservoir({providers, limit}): run providers in parallel, normalize, dedupe by term+sourceUrl, cache JSON daily.

Signal extraction

Emoji: regex parse titles/comments → frequency rank.

Acronyms: ALLCAPS regex, stop-list common tokens.

Memes/slang: phrase patterns (“é verdade esse bilhete”, “why does…”, “is … down”).

Context gathering (non-X first)

For the top-K winners, fetch 3–5 short examples from the same non-X providers (e.g., top Reddit comments, YouTube captions).

Store as SourceItem.text snippets (≤200 chars) + canonical link.

X enrichment (optional)

Implement enrichWithX(term) that spends 1 small search (≤20 results) per winner, capped by DAILY_CONTEXT_BUDGET.

Cache per term/day; if budget exhausted → queue for tomorrow.

Admin budget panel

Show “Today’s context budget: used/limit” and a toggle to run enrichment per item (manual override when testing).

Kill-switches

Env toggles: X_ENABLED, ENRICH_PROVIDERS, DAILY_CONTEXT_BUDGET.

If any provider fails or rate-limits → skip, keep pipeline moving.

What to tell Future You (and Codex)

Discovery must never depend on X.

Enrichment can optionally use X, but is budgeted, cached, and replaceable (Reddit/YT snippets are fine).

This preserves the factory as domain-agnostic, keeps niches as plugins, and makes providers hot-swappable.

Bottom line

You can launch and grow on $0 API spend using Reddit/HN/Trends/YouTube + RSS. Keep X disabled until revenue justifies Basic. When you flip it on, it’s spice—not the stew.