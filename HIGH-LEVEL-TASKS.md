Got it: local-first, cloud-ready, zero throwaway code. Here’s a plug-and-play plan that keeps everything in TypeScript/Node, uses the exact interfaces you’ll keep in prod, and defers cron/infra until the last mile.

The principle

Design by adapters from day one. In dev you swap in “local” adapters (SQLite, filesystem, in-memory queue, mock LLM, mock poster). In prod you flip env vars to use “cloud” adapters (Neon, B2/S3, Upstash, OpenAI, Buffer/Twitter). Same interfaces, same code paths.

Architecture (kept for prod; only adapters change)
apps/
  site/           # Next.js app (same in prod)
  worker/         # Node worker CLI (same in prod)
packages/
  core/           # types, zod schemas, ports (interfaces), config
  infra/          # DI container wiring (binds ports -> adapters)
  adapters/
    db/           # prisma-sqlite.ts, prisma-postgres.ts
    storage/      # fs-local.ts, s3-b2.ts
    queue/        # memory.ts, bullmq-upstash.ts
    llm/          # mock.ts, openai.ts (or anthropic.ts)
    render/       # puppeteer-og.ts, sharp.ts, ffmpeg.ts
    poster/       # mock.ts, twitter.ts, buffer.ts
    analytics/    # console.ts, plausible.ts
  features/
    ingest/       # scrapers (pure functions) + port to persist
    generate/     # LLM orchestration -> Draft
    publish/      # MDX compile + save + push
    distribute/   # social scheduling
    report/       # KPI report


Ports (interfaces) you’ll keep forever (defined in packages/core/ports.ts):

DB (Posts, SourceItems, Jobs)

Storage (put, getSignedUrl)

Queue (enqueue, process)

LLM (draftExplainer)

Renderer (renderOgCard, renderShort)

Poster (tweet, scheduleReel)

Analytics (track, pageview)

Adapters implement these ports; the DI container (packages/infra/container.ts) chooses which to bind based on env.

Env matrix (so flipping to cloud is just env)
ENV=local|staging|prod

# DB
DB_DRIVER=sqlite|postgres
DATABASE_URL=file:./data/dev.db  # local
# or postgres://...              # prod

# Storage
STORAGE_DRIVER=fs|s3
S3_ENDPOINT=https://s3.eu...b2.com
S3_BUCKET=...
S3_KEY=...
S3_SECRET=...

# Queue
QUEUE_DRIVER=memory|bullmq
REDIS_URL=...                    # only if bullmq

# LLM
LLM_DRIVER=mock|openai
OPENAI_API_KEY=...

# Poster
POSTER_DRIVER=mock|live
TWITTER_BEARER=...
BUFFER_TOKEN=...

# Analytics
ANALYTICS_DRIVER=console|plausible
PLAUSIBLE_DOMAIN=...
PLAUSIBLE_API_KEY=...

# Rendering
FFMPEG_PATH=... (optional)

Phased plan (build once, test locally, flip to cloud)
Phase 0 — Groundwork (2–3 days)

Goal: Project compiles, DI works, local adapters wired; everything runs with mocks.

 Scaffold monorepo (pnpm workspaces) + strict TS + eslint/prettier.

 Define ports in core/ports.ts with zod types.

 Implement DI container that resolves adapters from env.

 Adapters (local):

db/prisma-sqlite.ts (Prisma, SQLite file)

storage/fs-local.ts (writes to data/media)

queue/memory.ts (simple array + setInterval worker)

llm/mock.ts (deterministic drafts)

poster/mock.ts (logs to console, writes json to data/outbox)

analytics/console.ts (console.log)

 Next.js site skeleton + content page that fetches from DB by slug.

 Worker CLI with commands:

ingest:emoji (creates SourceItems from fixtures)

generate:drafts (LLM→draft Posts)

render:og (makes PNG locally)

publish:site (marks published + writes MDX or SSR renders)

Success: Run pnpm dev:local and see a published post at http://localhost:3000/<slug> with OG image. No internet needed.

Phase 1 — Local E2E (manual trigger, no cron) (3–5 days)

Goal: Full pipeline works on your machine end-to-end with a “click to approve” step.

 Local admin UI /admin:

List drafts, view JSON, Approve → Publish

 Renderer: puppeteer-og.ts with basic template (kept for prod)

 Ingest (still mock): emoji/acronym fixtures; scoring fn (engagement+recency+novelty)

 Publish: Next.js reads from DB (SSR) so you don’t need to write MDX files locally (less churn)

 Distribute: poster/mock.ts writes the planned tweet/caption + link to data/outbox/social.json

Success: Create 5 drafts → approve → pages render locally; “would-post” payloads saved; simple KPI console report prints counts.

Phase 2 — Real inputs, still local (2–4 days)

Goal: Replace mocks where valuable, still run everything locally.

 Ingest (real): one scraper per niche (Twitter search endpoint or RSS/news APIs you’re comfortable with). If live APIs are a hassle, keep ingest as CSV imports you drop into /data/ingest.

 LLM (real): switch LLM_DRIVER=openai (same port) for generation; keep a FIXTURE_MODE that caches outputs to JSON for deterministic re-runs.

 OG image design pass: tweak template for readability; keep componentized HTML so you can reuse in prod.

Success: You can run pnpm run once:emoji and produce 3 real posts with usable copy and decent OG cards.

Phase 3 — Cloud-compatible adapters (flip, test locally) (2–3 days)

Goal: Implement prod adapters but test them from your laptop. No cron yet.

 DB Postgres adapter: db/prisma-postgres.ts (switch DATABASE_URL to Neon for a quick smoke test, then back to SQLite during dev).

 Storage S3 adapter: storage/s3-b2.ts (point to B2; from local run, upload and confirm public URL works).

 Queue BullMQ: queue/bullmq-upstash.ts (create queue, process with a local worker).

 Poster live: connect twitter-api-v2 and Buffer sandbox; keep POSTER_DRIVER=mock by default.

Success: From your laptop, publish one post that uploads OG to B2 and returns a working CDN URL (even if your site is still local). Toggle back to local adapters instantly.

Phase 4 — Staging slice (1–2 days)

Goal: Minimal cloud footprint, still mostly local dev, no cron.

 Deploy site to Vercel (staging env). SSR still pulls from Neon staging DB.

 Keep worker local; point it to Neon staging + B2 for a single end-to-end publish.

 Verify SEO basics (titles, meta, sitemap) on staging domain.

Success: You run local worker → content appears on the staging site with CDN OG image. Post payloads ready to send.

Phase 5 — Prod cutover (small, reversible) (1–2 days)

Goal: Minimal prod stack, still manual triggers, cron later.

 Create prod env: Neon prod DB, B2 prod bucket, Vercel prod site.

 Deploy site prod; admin still local-only (or password-protect staging admin).

 Manual run the local worker against prod env to publish the first 5 posts.

Success: Live URLs render fast with OG images; analytics receives pageviews.

Phase 6 — Automation (cron last) (0.5–1 day)

Goal: Turn manual CLI into scheduled runs. This is the only “new” thing added.

Option A: Vercel Cron → /api/tasks/run (worker pulls jobs from BullMQ)

Option B: GitHub Actions cron hitting /api/tasks/run

Option C: Railway tiny worker running node apps/worker/index.js forever

Success: One scheduled execute per day publishes top N, with logs and alerts to Sentry.

Task board (ready to drop into Linear/Jira)
Epic: Ports & Adapters Baseline

Story: Define ports & DI

To-Dos: write ports.ts, container, env resolution; unit tests for each port

Acceptance: swapping env changes bound adapter, unit tests pass

Story: Local adapters

FS storage, Prisma SQLite, memory queue, mock LLM, mock poster, console analytics

Acceptance: pnpm dev:local creates draft + OG in data/media

Epic: Local E2E with Manual Review

Story: Ingest mock + scoring

Acceptance: pnpm ingest:emoji adds ≥10 SourceItems; pnpm select marks top 3 queued

Story: Generate drafts (mock)

Acceptance: pnpm generate creates Posts (status=draft) with all sections

Story: Render OG + publish locally

Acceptance: /[slug] renders, OG visible via local path

Story: Admin approve/publish

Acceptance: /admin lists drafts; clicking publish flips status and page updates

Epic: Real Inputs, Still Local

Story: Add one real scraper

Acceptance: pnpm ingest:emoji --live inserts ≥5 items from the web (or CSV import)

Story: OpenAI generator

Acceptance: LLM_DRIVER=openai produces well-formed JSON; FIXTURE_MODE=on caches outputs

Story: OG design v1

Acceptance: Lighthouse ≥ 90 for OG HTML; text readable at 1200×630

Epic: Cloud Adapters (Test from Local)

Story: S3/B2 storage

Acceptance: STORAGE_DRIVER=s3 uploads OG to B2; returned URL public via CDN

Story: Postgres adapter

Acceptance: switch DB to Neon staging; create/read posts successfully; migrate runs cleanly

Story: BullMQ queue

Acceptance: enqueue + process job locally against Upstash; retries & dead-letter work

Story: Poster live (gated)

Acceptance: POSTER_DRIVER=live posts a test tweet to sandbox; otherwise mock

Epic: Staging Slice

Story: Vercel staging

Acceptance: staging domain shows pages, uses Neon staging DB; OG URLs are CDN

Story: SEO basics

Acceptance: sitemap.xml, robots.txt, JSON-LD (FAQ), canonical links validated

Epic: Prod Cutover

Story: Prod envs + first publish

Acceptance: 5 live posts at prod domain; Plausible receiving events; no broken assets

Epic: Cron & Alerts

Story: Scheduler

Acceptance: One scheduled run/day; logs visible; failure alert (Sentry) triggers on error

Success criteria per phase (quick checklist)

P0: pnpm dev:local → 1 draft + 1 published page locally, OG image exists

P1: Approve via /admin, no cloud needed

P2: Same as P1 but with real LLM output (cached)

P3: From local, publish a post whose assets live on B2; switching back to local is one env change

P4: Local worker → staging site shows content

P5: Local worker → prod site shows content; analytics live

P6: Cron fires → daily publish without you touching anything

“No throwaway code” guardrails

Keep ports thin and stable. If you change a port, you’ll change two adapters; so get the interface right once.

Use the same rendering & LLM flows in dev and prod; only the providers change.

Fixture everything. Cache LLM outputs and ingest samples; they double as unit tests.

12-factor: all config from env; never hardcode paths or keys.

One binary, many modes: apps/worker reads env and calls the same runPipeline()—manual one-shot locally, cron later.

Dev scripts (QoL)
{
  "scripts": {
    "dev:local": "pnpm -w run build:types && cross-env ENV=local LLM_DRIVER=mock DB_DRIVER=sqlite STORAGE_DRIVER=fs next dev -w apps/site",
    "once:emoji": "cross-env ENV=local node apps/worker/once-emoji.js",
    "ingest": "ts-node apps/worker/ingest.ts",
    "generate": "ts-node apps/worker/generate.ts",
    "render": "ts-node apps/worker/render.ts",
    "publish": "ts-node apps/worker/publish.ts",
    "smoke:staging": "cross-env ENV=staging STORAGE_DRIVER=s3 DB_DRIVER=postgres ts-node apps/worker/once-emoji.ts"
  }
}

Minimal migration checklist (when you’re ready)

Flip DB_DRIVER=postgres and point to Neon; run migrations.

Flip STORAGE_DRIVER=s3 and set B2 env; confirm OG upload + public URL.

Deploy site to Vercel (staging), point site env to Neon + B2.

Run local worker against staging env; sanity check.

Duplicate envs for prod; publish first batch.

Add cron; wire Sentry/alerts.

This plan keeps you in local land as long as you want, while every line of code is the same code you’ll run in prod—only the adapters/config change. When you decide to go live, you’re flipping switches, not rewriting.
