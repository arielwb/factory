Sweet — here’s a **priority-ordered, plug-and-play task list** to add non-Twitter trend inputs, wired for **scalability** (one shared reservoir), **cost control** (caching/budgets), and **future growth** (feature-flagged providers). It’s written so you (or any AI) can implement without guessing.

---

# 0) Architecture guardrails (do first)

**Goal:** one *shared* “Discovery Reservoir” all niches mine; providers are hot-swappable.

* [ ] **Contracts (keep generic)**

  * `DiscoveryItem { id, text, lang, source, url, ts, meta? }`
  * `Reservoir = DiscoveryItem[]`
* [ ] **Provider interface**

  ```ts
  export interface Provider {
    name: string;
    fetch(params: { since?: Date; limit?: number }): Promise<DiscoveryItem[]>;
  }
  ```
* [ ] **Registry & DI**

  * `packages/providers/<name>.ts` per source
  * `DISCOVER_PROVIDERS=reddit,hn,trends,youtube,news,paa` (env)
* [ ] **Reservoir builder**

  ```ts
  buildReservoir({ providers, limitPerProvider, since, cacheKey }): Promise<Reservoir>
  ```

  * Merges, **dedupes by url** (and `text` similarity), **caches to JSON** (daily).

**Scalability notes:** One reservoir per run → O(1) fetch cost for all plugins. Caching avoids re-fetch. Dedup keeps memory small.

---

# 1) Core plumbing (performance & safety)

* [ ] **Caching**: `withCache(key, ttl, fn)` → `data/fixtures/reservoir-YYYY-MM-DD.json`
* [ ] **Rate/budget**: `RequestBudget(daily, monthly).consume(n)` → throws on overuse
* [ ] **Backoff**: `retry(fn, { attempts:3, base:500ms, jitter:true })`
* [ ] **Concurrency**: `p-limit(3)` to bound parallel provider calls
* [ ] **Circuit breaker**: trip provider after N failures, skip until next day
* [ ] **Normalization**: strip HTML, trim to 240 chars, `lang` guess if missing
* [ ] **Observability**: log `PROVIDER_OK/ERR`, items count, elapsed ms; `/api/health/discovery` reports last success per provider

**Success criteria:** Reservoir build logs a summary; re-run within TTL hits cache (0 external calls).

---

# 2) Providers — MVP order (highest ROI first)

## 2.1 Reddit (hot/new JSON or RSS)

* [ ] Implement `providers/reddit.ts`

  * Inputs: `REDDIT_SUBS=brasil,Portugal,ProgrammerHumor,explainlikeimfive`
  * Fetch `hot.json?limit=50` per sub; map to items (title, url, ups, ts)
  * **Filter**: remove NSFW; PT subs → `lang="pt"`
* [ ] Add **comment sampler** (top 3 comments as optional `meta.snippets`)

**Success:** ≥150 items/ run; <3s fetch; clean PT/EN split.

---

## 2.2 Google Trends (free endpoints/libs)

* [ ] `providers/trends.ts`

  * Inputs: `TRENDS_TERMS="emoji significado|emoji meaning|LOL significado|SMH meaning|por que"`
  * Fetch interest-over-time & related queries; map top rising into items
  * Save `meta.score`
* [ ] **Heuristic**: ignore score < threshold (e.g., <10)

**Success:** ≥20 “rising queries”/run; includes PT and EN.

---

## 2.3 YouTube Trending + search

* [ ] `providers/youtube.ts`

  * Inputs: `YOUTUBE_REGIONS=US,BR,PT`; `YOUTUBE_API_KEY`
  * Fetch trending videos (titles); optional: search `"what does"`, `"significado"`, `"por que"`
  * Extract candidate phrases (emoji, acronyms, “why …”)
* [ ] Caption stubs (later): only if quota allows; otherwise titles suffice

**Success:** ≥60 items/ run; titles include slang/emoji tokens.

---

## 2.4 Google News / Bing News (RSS)

* [ ] `providers/news.ts`

  * Inputs: `NEWS_FEEDS` (tech/culture/BR portals)
  * Parse RSS; map titles → items; ignore duplicates
* [ ] **Use case**: detect sudden slang/celebrity moments → meme explainers

**Success:** ≥30 items/run; spike detection works (more items on busy days).

---

## 2.5 People Also Ask (SERP question miner)

* [ ] `providers/paa.ts`

  * Inputs: seeds `["emoji significado","emoji meaning","por que","what does"]`
  * Headless fetch (Puppeteer) with low frequency; extract questions
  * Respect robots.txt; low volume; cache aggressively (weekly TTL)

**Success:** ≥25 unique “why/what does … mean” questions/week.

---

# 3) Signal extraction (per niche, from one reservoir)

* [ ] **Emoji signals**

  * Regex scan reservoir texts for emoji; count frequency; top-K
  * Novelty: down-weight ❤️ 😂
* [ ] **Acronym/Slang signals**

  * Regex `\b[A-Z]{2,5}\b` + allowlist/stoplist (SMH, POV, LOL, LMAO, IMHO, BR-specific slang list)
  * For PT: lowercase slang list (`cringe`, `shippar`, `bolado`)
* [ ] **Why-question signals**

  * Regex `^(por que|porque|why\s+do|why\s+does|why\s+is)\b` from PAA/Reddit/YT titles
* [ ] **Meme signals**

  * N-gram bump (sudden rise of bigrams like `"Guiana Brasileira"`, `"é verdade"`)

**Success:** Each extractor returns ranked candidates with `score` and source evidence.

---

# 4) Budgeted context enrichment (optional, non-Twitter)

* [ ] **Reddit comments**: fetch 3 top comments for winning items (1 call/item)
* [ ] **YouTube descriptions**: fetch 1–2 descriptions for winning items
* [ ] **News excerpt**: 1–2 sentences
* [ ] Budget gate: `DAILY_CONTEXT_ITEMS=5`; cache per term/day

**Success:** Top-K items enriched with 2–3 diverse snippets; never exceed daily budget.

---

# 5) Wiring into the factory (unchanged interfaces)

* [ ] `buildReservoir()` runs at start of pipeline; stores `Reservoir`
* [ ] Plugins read `Reservoir` → `SourceItem[]` (emoji/acronyms/why/memes)
* [ ] Score & queue top candidates
* [ ] Generator/Renderer/Publish unchanged

**Success:** End-to-end publish works using non-Twitter signals only.

---

# 6) Resource optimization & scalability knobs

* **Scheduling**: run reservoir **2×/day** (morning/evening) → fresh but cheap
* **TTL tiers**: Reddit/News (hours), Trends (daily), PAA (weekly)
* **Backpressure**: if reservoir > N items, **sample** or cap per provider
* **Sharding**: when load grows, split providers into separate worker jobs, write reservoir to DB/storage, site reads from DB as before
* **Feature flags**: per provider (`PROVIDER_X_ENABLED=false`) to isolate failures
* **Metrics**: store `reservoir_size`, `per_provider_count`, `extractor_yield`, `queue_size`, `context_spend_today`

---

# 7) Concrete tasks checklist (drop into Linear/Jira)

**Epic: Discovery Reservoir**

* [ ] Create contracts, provider interface, DI, caching, budgets, retry, health endpoint
* [ ] Reservoir builder with dedupe + daily cache

**Epic: Providers**

* [ ] Reddit provider (subs env + tests)
* [ ] Trends provider (seeds env + tests)
* [ ] YouTube provider (trending + search)
* [ ] News RSS provider (configurable feeds)
* [ ] PAA provider (headless, low-freq)

**Epic: Extractors**

* [ ] Emoji extractor (freq + novelty)
* [ ] Acronym/slang extractor (en/pt stop/allow lists)
* [ ] Why-question extractor
* [ ] Meme n-gram spike detector

**Epic: Enrichment**

* [ ] Comment/description/news excerpt fetcher (budgeted, cached)
* [ ] Admin panel: show reservoir counts, top signals, budget used

**Epic: Perf & Ops**

* [ ] p-limit concurrency + circuit breaker per provider
* [ ] Metrics & logs; /api/health/discovery
* [ ] Scheduler (local dev: manual; prod: cron later)

---

# 8) Env config (single source of truth)

```env
DISCOVER_PROVIDERS=reddit,hn,trends,youtube,news,paa
RESERVOIR_LIMIT_PER_PROVIDER=100
RESERVOIR_TTL_HOURS=24

# Reddit
REDDIT_SUBS=brasil,Portugal,ProgrammerHumor,explainlikeimfive

# Trends
TRENDS_TERMS=emoji significado|emoji meaning|LOL significado|SMH meaning|por que|why does

# YouTube
YOUTUBE_API_KEY=...

# News
NEWS_FEEDS=https://news.google.com/rss?hl=pt-BR&gl=BR,https://news.google.com/rss?hl=en-US&gl=US

# PAA (headless rate)
PAA_MAX_RUNS_PER_WEEK=3

# Context budget
DAILY_CONTEXT_ITEMS=5
```

---

# 9) Acceptance criteria (scalable + lean)

* One `buildReservoir()` run yields **≥250 unique items** in <5s locally (cached), <20s cold, with per-provider caps respected.
* Re-runs within TTL **make 0 external calls** (cache hit).
* Extractors produce **≥5 high-scoring candidates** per niche per day.
* Enrichment never exceeds **DAILY\_CONTEXT\_ITEMS**, with clear logs.
* A provider outage doesn’t fail the pipeline (circuit breaker + partial success).

---

This gives you a **low-cost, high-signal trend engine** that scales: one reservoir, many signals, strict budgets, no X/Twitter required. Flip providers on/off with envs; metrics keep you honest; caching keeps it cheap.
