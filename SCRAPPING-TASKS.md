Epic: Ingest/Scraping (Local-first, Cloud-ready)

Goal: Build deterministic, testable scrapers that emit TSourceItem[], validate with Zod, cache locally, and can later flip to live APIs with only env changes.
Definition of Done (epic): For each target niche, pnpm ingest:<niche> --mock and --live both work; items are validated, deduped, cached; rate limits respected; errors surfaced to logs; and downstream pipeline (generate → render → publish) can run from the ingested data without edits.

Story 1 — Ingest Framework & Contracts

Goal: Establish the scaffold every scraper uses (ports, helpers, caching, validation, dedupe).

To-dos

 Create packages/features/ingest/runner.ts with:

runIngest({ niche, drivers: { mock, live }, cacheKey, limit })

Flags: --live, --limit=50, --nocache

 Add Zod validator SourceItem (already in SPEC) and a validateItems() helper that throws on first error and prints a diff.

 Implement withCache(filename, fn) helper (read/write JSON under data/fixtures/).

 Add hashId() helper (stable ID from sourceUrl + term) to dedupe.

 Add normalizeEmoji(term) and detectLang(text) utilities (basic heuristics OK for MVP).

Success criteria

Running pnpm ts-node packages/features/ingest/runner.ts --mock --limit=3 prints a validated array and writes data/fixtures/<cacheKey>.json.

Invalid items trigger a readable Zod error with the index and field name.

Story 2 — Emoji Scraper (Mock → Live)

Goal: Produce trending emoji items.

To-dos

 File: packages/ingest/emoji.mock.ts → returns 3 hard-coded items.

 File: packages/ingest/emoji.twitter.ts → fetch recent tweets matching 1–3 emoji (configurable), map to TSourceItem.

Input env: TWITTER_BEARER

Query string built from EMOJI_QUERY="🪿 🥲 🫨" (space-separated)

 Add caching wrapper fetchTrendingEmojisTwitterCached().

 Wire command: pnpm ingest:emoji --mock|--live --limit=20

Success criteria

Mock returns exactly 3 items.

Live returns ≥5 items with distinct id, valid sourceUrl, and non-empty text.

Cache file emoji-twitter.json created; re-run without --nocache doesn’t hit network.

Story 3 — Acronyms/Jargon Scraper (Mock → Live)

Goal: Capture trending acronyms (POV, TBT, ETA…).

To-dos

 packages/ingest/acronyms.mock.ts → 5 items.

 packages/ingest/acronyms.twitter.ts or acronyms.reddit.ts (choose one now; add the other later).

Twitter: recent search for regex-like \b[A-Z]{2,5}\b (client-side filter after fetch).

Reddit: pull hot titles from target subs; extract ALLCAPS tokens.

 Add filterStoplist() (exclude “USA”, “HTTP”, “CPU” if not desired).

Success criteria

Live returns ≥10 unique acronym terms after stoplist.

≥80% items have lang set correctly (en or pt).

Story 4 — Portuguese Memes/Slang Scraper (Mock → Live)

Goal: Gather PT-BR/PT meme phrases.

To-dos

 packages/ingest/ptmemes.mock.ts → 5 items (kkkkk, zoeira, oxi, etc.).

 packages/ingest/ptmemes.reddit.ts (read /r/brasil, /r/Portugal top/day), map titles/comments to items.

 Optional: TikTok captions via scheduler tool API or CSV import (if APIs are gated).

 Add lang=pt default; detect Brazilian vs European Portuguese later (deferred).

Success criteria

Live returns ≥10 items with lang="pt" and term normalized (the short phrase, not entire sentence).

Dedupe by term+sourceUrl reduces near duplicates.

Story 5 — Troubleshooting/Error Codes Scraper (Mock → Live)

Goal: Queries like “is X down”, common error codes.

To-dos

 packages/ingest/troubleshoot.mock.ts → 5 items (e.g., “WhatsApp down”, “ERR_CONNECTION_RESET”).

 packages/ingest/troubleshoot.rss.ts → ingest support RSS feeds or vendor status RSS (where available), plus subreddit titles (e.g., /r/techsupport).

 Normalize term to the error code or product+status (“WhatsApp down”).

Success criteria

Live returns ≥10 items with term length < 40 chars and sourceUrl pointing to a thread or status page.

Items are time-stamped and sorted by recency for scoring.

Story 6 — Biology “Why” Questions Scraper (Mock → Live)

Goal: Everyday biology why-questions (“Why do onions make you cry?”).

To-dos

 packages/ingest/bio.mock.ts → 5 items.

 packages/ingest/bio.reddit.ts → parse /r/explainlikeimfive, /r/askscience titles, filter for “why do/why does/what is” patterns.

 Add NSFW/medical misinfo filter (basic keyword denylist).

Success criteria

Live returns ≥10 well-formed questions in plain English.

Denylist filters out unsafe/medical-diagnosis queries for MVP.

Story 7 — Scoring, Dedupe, & Queueing

Goal: Pick top N items per run, resiliently.

To-dos

 Implement scoreItem() (engagement log, recency decay, novelty vs. existing terms).

 Add cosine-similarity novelty check using simple embeddings OR fallback to Levenshtein distance for MVP.

 DB method queueTopNForDraft(niche, n) selects non-queued items with best score, marks them queued atomically.

Success criteria

Re-running ingest doesn’t re-queue duplicates.

Top 3 returned are consistent across runs with caching; change in cache changes order.

Story 8 — Validation, Rate Limits, and Error Handling

Goal: Make scrapers trustworthy and friendly to APIs.

To-dos

 Wrap fetch in retry(fn, { attempts:3, backoff: 500ms*2^n }).

 Respect X-RateLimit-Remaining headers where present; auto-sleep if <10%.

 Standardize errors: { scraper, niche, message, lastUrl }.

 Unit tests: malformed JSON, empty results, and rate-limit branch.

Success criteria

Simulated 429 triggers backoff and eventual success/fail with clear log.

Bad item fails validation and is skipped with index & reason logged.

Story 9 — Local Admin “Ingest Console”

Goal: Operate scrapers without CLI.

To-dos

 /admin/ingest page: pick niche, pick driver (mock/live), limit, and run.

 Show last 50 SourceItems per niche with validation status and score.

 Button: “Queue Top 3” → calls queueTopNForDraft.

Success criteria

From the browser, you can fetch live data, see validation, and queue items for generation—no terminal required.

Story 10 — Security & Compliance (MVP scope)

Goal: Avoid publishing PII or copyrighted content.

To-dos

 Scrapers store URLs & short excerpts only—no wholesale copying of posts.

 Simple PII scrubber: remove emails, phone numbers from text.

 Profanity/slur check with a denylist; mark safetyFlag=true for review before generation.

Success criteria

Any safetyFlag=true item is never auto-queued; appears highlighted in admin.

Story 11 — Metrics & Observability for Ingest

Goal: See what’s happening.

To-dos

 Log counters: INGEST_SUCCESS, INGEST_EMPTY, INGEST_ERRORS, per niche/driver.

 Add an /api/health/ingest endpoint returning last run timestamps per niche.

 Optional: chart in admin (simple bar chart) using counts from the DB.

Success criteria

Hitting /api/health/ingest shows niches with last-run times; running ingest updates the timestamp.

Story 12 — Staging Smoke (No Cron)

Goal: Prove the live stack works by flipping adapters, still running from your laptop.

To-dos

 Set DB_DRIVER=postgres → Neon staging; migrate.

 Set STORAGE_DRIVER=s3 → B2 staging; test one upload.

 Run pnpm ingest:<niche> --live --limit=5 then queue + generate one post end-to-end.

Success criteria

Items land in Neon staging; OG image in B2; staging site can render a post that was fed by live ingest.

Optional Stories (Add when ready)

S-A: Google Trends scraper (long-tail discovery for holidays/events).

S-B: TikTok captions via scheduler export → CSV ingestion.

S-C: Sitemap backfill task (generate index pages per niche automatically).

S-D: Per-niche stoplists/allowlists managed from admin UI.

Commands & Scripts (drop in package.json)
{
  "scripts": {
    "ingest:emoji": "ts-node packages/features/ingest/run-emoji.ts",
    "ingest:acronyms": "ts-node packages/features/ingest/run-acronyms.ts",
    "ingest:ptmemes": "ts-node packages/features/ingest/run-ptmemes.ts",
    "ingest:troubleshoot": "ts-node packages/features/ingest/run-troubleshoot.ts",
    "ingest:bio": "ts-node packages/features/ingest/run-bio.ts",
    "ingest:all": "run-s ingest:emoji ingest:acronyms ingest:ptmemes",
    "queue:top": "ts-node packages/features/ingest/queue-top.ts"
  }
}


Each run-*.ts file should:

Parse flags (--live, --limit, --nocache)

Resolve the proper scraper (mock/live)

Fetch → validate → dedupe → (optionally) cache

Persist via db.upsertSourceItems(items)

Print a small summary (count, first term, cache path)

Acceptance Tests (for the whole Epic)

AT-1: --mock path produces 3–5 items for each niche; all pass Zod; cached fixtures written.

AT-2: --live path for at least two niches returns ≥5 items each; rate limit respected if encountered.

AT-3: queueTopNForDraft ignores duplicates and only queues items not seen before.

AT-4: Admin Ingest Console runs a live fetch and shows validation; “Queue Top 3” succeeds.

AT-5: From live ingest, you can run the rest of the pipeline (generate → render → publish) without code edits.

AT-6: Flip to staging env (Neon + B2) and repeat AT-5 successfully.

Timeline (just for this Epic)

Week 1: Stories 1–3 (framework, emoji, acronyms)

Week 2: Stories 4–7 (PT memes, troubleshoot, scoring/queueing)

Week 3: Stories 8–11 (resilience, admin console, metrics)

Week 4: Story 12 (staging smoke) and any optional scrapers

Env Quick Reference (scrapers)
# Twitter
TWITTER_BEARER=...

# General
INGEST_DRIVER=mock|twitter|reddit|rss
INGEST_LIMIT=20
INGEST_NOCACHE=true|false


This gives you a hands-on, line-by-line battle plan for ingest that matches your local-first, cloud-ready philosophy. You can paste this whole epic into your backlog, or split each story into individual tickets with the success criteria verbatim. Once ingest is solid, the rest of the pipeline has clean fuel—and swapping niches is just switching which run-*.ts you call.

ChatGPT can make mistakes. Check important info. See Cookie Preferences.