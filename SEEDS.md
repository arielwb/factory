Absolutely—here’s a plug-and-play plan for a **`trends.ts` provider (EN-only)** that *learns from Trends* instead of watching a fixed list. It uses a tiny static **seed set** to fetch **Related/Rising** queries, then **scores + promotes** them to a rolling watchlist your factory mines.

# Goals (in plain English)

* Start with **generic English seeds** (not specific terms).
* Pull **Related/Rising** queries for each seed daily.
* **Score** for growth + consistency, **promote** winners to a rolling watchlist.
* Emit normalized `DiscoveryItem[]` for your shared reservoir.
* **Cache aggressively** so you don’t hammer anything.

---

## 1) Seeds (EN only, stored in `.env`)

Keep this small; it’s a fishing net, not a library.

```env
TRENDS_SEEDS_EN=emoji meaning,what does ... mean,acronym meaning,what does POV mean,what does SMH mean
TRENDS_GEO=WORLDWIDE  # or "WORLDWIDE" / "GB" etc.
TRENDS_TIMEWINDOW=now 7-d  # or "last 30 days"
TRENDS_MAX_PROMOTED=20
TRENDS_MIN_GROWTH=50
TRENDS_CACHE_TTL_HOURS=24
```

> Tip: include 1–2 specific “evergreen anchors” (POV, SMH) to bootstrap related results even on quiet days.

---

## 2) Data contracts

```ts
// Raw discovery item sent to the reservoir
export type DiscoveryItem = {
  id: string;                   // hash(seed + query)
  text: string;                 // the query string (e.g., "blue heart emoji meaning")
  lang: "en";
  source: "trends";
  url: string;                  // a Google search URL for the query (canonical)
  ts: number;                   // Date.now()
  meta?: {
    seed: string;
    type: "rising" | "top";
    score: number;              // Trends score (0–100 or “rising score”)
    growth?: number;            // computed growth %
  };
};
```

**Internal store** (to persist learning):

```ts
// trends_state.json
{
  "watchlist": [ "blue heart emoji meaning", "skull emoji meaning", ...],
  "lastSeen": { "blue heart emoji meaning": "2025-08-28", ... },
  "seenScores": { "blue heart emoji meaning": [12, 35, 55], ... }
}
```

---

## 3) Provider interface & entry point

```ts
// providers/trends.ts
import { Provider } from "./types";
export const trendsProvider: Provider = {
  name: "trends",
  async fetch({ since, limit }) {
    // 1) load seeds from env
    // 2) for each seed -> fetch related queries (top + rising)
    // 3) normalize to DiscoveryItem[]
    // 4) score & promote winners to watchlist
    // 5) return DiscoveryItem[] (deduped)
  }
};
```

---

## 4) Fetching Related/Rising (library or lightweight headless)

* Use a Trends lib if you have one available in Node; otherwise:

  * Light headless fetch (Puppeteer) to the trends related-queries endpoint for each seed + `TRENDS_GEO` + `TRENDS_TIMEWINDOW`.
* **Cache per seed**: `cache/trends/<seed>-<geo>-<window>-YYYY-MM-DD.json`

  * Cache both **related top** and **rising** arrays with their scores.

Minimal pseudo:

```ts
const res = await getRelatedQueries({ q: seed, geo, time: window });
// res.top = [{query, score}, ...]
// res.rising = [{query, score}, ...]
```

---

## 5) Normalization → `DiscoveryItem[]`

For each `{query, score}`:

```ts
items.push({
  id: hash(`${seed}|${query}`),
  text: query,
  lang: "en",
  source: "trends",
  url: `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  ts: Date.now(),
  meta: { seed, type: "rising", score }
});
```

> Include both **top** and **rising**, but you’ll **promote** based on growth (below).

---

## 6) Scoring & Promotion (the “learning” bit)

### Keep state

* Load `trends_state.json` (if missing, create).
* Maintain:

  * `watchlist` (rolling array up to `TRENDS_MAX_PROMOTED`)
  * `seenScores[query]` (last N scores to compute growth)
  * `lastSeen[query]` (for recency decay)

### Compute growth

* Append the new `score` to `seenScores[query]` (cap length at, say, 4).
* **Growth %** = `(latest - median(previous)) / max(1, median(previous)) * 100`.
* If previous history missing, treat growth as `score`.

### Promotion rule

Promote a query if:

* `growth >= TRENDS_MIN_GROWTH` **OR** `score >= 70` (hot even without history), **AND**
* It matches your **intent filters** (emoji/a acronyms):

  * contains `"emoji"` **AND** (`"meaning"` or `"what does"`), **OR**
  * matches acronym pattern: `\b[A-Z]{2,5}\b\s+meaning` (LOL/LMAO/SMH/POV/NSFW/FTW/BRB/ROFL/ICYMI/etc.)

### Watchlist management

* Add to `watchlist` if not present.
* If over `TRENDS_MAX_PROMOTED`, drop the **oldest/lowest-scored** items.
* Update `lastSeen[query] = today`.

---

## 7) Emitting to the reservoir

* **Always** emit all normalized `DiscoveryItem[]` (top+rising) → the reservoir.
* **Additionally**, expose your **promoted watchlist** to the **emoji/acronym plugins** so they can do deeper context fetch (from Reddit/YouTube/News) on the top candidates.

> In practice: return `DiscoveryItem[]`, and write `trends_state.json` so your emoji/acronym extractors can read `watchlist` (or expose a tiny `getTrendsWatchlist()` in the provider package).

---

## 8) Caching & budgets

* **Per-seed cache TTL** = `TRENDS_CACHE_TTL_HOURS` (usually 24h).
* If cache fresh, **do not re-fetch**; just normalize from cache (0 external calls).
* **Budget**: cap seeds processed per run (e.g., 5–10); cap related queries ingested per seed (e.g., top 20).

---

## 9) Safety filters (keep signal clean)

* Lowercase & trim queries.
* Drop queries containing PII, adult content, or off-topic terms.
* Deduplicate by query string.
* Pass only **English** (heuristic: ASCII heavy + stopword check; optional lang detect).

---

## 10) Example flow (one run)

1. Seeds: `["emoji meaning","what does ... mean","acronym meaning"]`
2. For each seed:

   * Pull cached `related.top` + `related.rising` (fetch if stale).
   * Normalize to `DiscoveryItem[]`.
3. Update `trends_state` growth stats.
4. Promote winners → update `watchlist`.
5. Return combined items (deduped) to the reservoir.
6. Emoji/Acronym extractors pull `watchlist` and chase context from Reddit/YT/News.

---

## 11) Acceptance criteria

* Fresh run (no cache) finishes in < 15s for 5 seeds; cached run < 1s.
* Produces **≥ 15** unique EN queries/day, with **≥ 5** promoted into `watchlist`.
* `watchlist` never exceeds `TRENDS_MAX_PROMOTED` and rotates over time.
* At least **60%** of promoted queries match emoji/acronym intent filters.
* Re-running within TTL makes **0 external calls** and yields identical results.

---

## 12) Test cases (minimal)

* **No history**: a query with `score=80` is promoted (hot by absolute).
* **Rising**: prev median 10 → now 35 ⇒ growth 250% ⇒ promoted.
* **Decay**: a query absent for 30 days gets de-promoted when new ones arrive.
* **Intent**: “blue heart emoji meaning” passes; “blue heart tattoo meaning” fails (not emoji).

---

## 13) Handy seed CSV (EN only; small + generic)

Use this for `TRENDS_SEEDS_EN`:

```
emoji meaning,what does ... mean,acronym meaning,what does POV mean,what does SMH mean
```

---

## 14) Where the value shows up

* Your reservoir gets **current** candidate queries daily (not a stale list).
* Emoji/Acronym plugins get a **rolling watchlist** that reflects what’s *actually* rising, so your explainers hit the zeitgeist instead of yesterday’s slang.

If you want, I can also sketch the **exact file layout + code stubs** (`getRelatedQueries()`, `scoreAndPromote()`, cache helpers) so you can paste them into `packages/providers/trends/` and run the first cached cycle today.
