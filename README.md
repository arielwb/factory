Factory Monorepo — Content Pipeline (MVP)

Quick start
- Install: pnpm i
- DB (first run): pnpm exec prisma migrate dev -n init
- Env: copy .env.template → .env and fill values

Core flow (CLI)
- Ingest (non‑X discovery):
  - ENV_FILE=.env pnpm run ingest:emoji -- --live --limit=15 --nocache
- Generate N drafts:
  - Mock LLM: ENV_FILE=.env LLM_DRIVER=mock pnpm run generate -- --plugin=emoji --count=3
  - OpenAI:   ENV_FILE=.env LLM_DRIVER=openai pnpm run generate -- --plugin=emoji --count=3
- Site (preview/publish):
  - pnpm --filter @factory/site dev
  - Preview: /api/preview?secret=PREVIEW_SECRET&slug=<slug>
  - Admin:   /admin → Publish
- Distribute (mock poster → data/outbox/social.json):
  - Watch: ENV_FILE=.env pnpm run distribute:watch

Discovery providers (non‑X)
- Configure in .env:
  - DISCOVER_PROVIDERS=reddit,hn,trends,youtube,rss
  - YT_API_KEY=...  RSS_FEEDS=...  REDDIT_SUBS=...
  - RESERVOIR_LIMIT_PER_PROVIDER=100  RESERVOIR_TTL_HOURS=24
- Inspect providers:
  - ENV_FILE=.env pnpm run test:reservoir -- --rows=300 --top=10
- Inspect DB terms:
  - ENV_FILE=.env pnpm run db:terms -- --limit=20

Twitter (optional, paid tier later)
- Keep X off by default: X_ENABLED=false, ENRICH_PROVIDERS=""
- When ready: X_ENABLED=true, ENRICH_PROVIDERS=x_context, DAILY_CONTEXT_BUDGET=5, TWITTER_BEARER=...

SEO slice
- Home page lists recent posts: /
- Sitemap: /sitemap.xml  Robots: /robots.txt  RSS: /rss.xml
- Posts include canonical/OG + JSON‑LD Article

Useful envs
- SITE_ORIGIN=http://localhost:3000
- PREVIEW_SECRET=<strong-string> (and optionally NEXT_PUBLIC_PREVIEW_SECRET for local admin link)
- LLM_DRIVER=mock|openai, OPENAI_API_KEY=..., OPENAI_MODEL=gpt-4o-mini
- INGEST_DRIVER=mock|live (or pass --live flag)

Troubleshooting
- “Only goose” drafts: queue or delete 🪿 SourceItems; then re‑ingest.
- Rate limits/reads: reservoir is cached by day; delete data/fixtures/reservoir-YYYY-MM-DD.json to refetch.
- OpenAI errors: use LLM_DRIVER=mock to keep pipeline moving.

Scripts reference
- ingest:emoji — run discovery → upsert SourceItems
- generate — create N drafts from queued items
- publish:top — publish N oldest drafts
- distribute:recent — plan posts for recently published
- distribute:watch — auto‑plan on publish events
- test:reservoir — build reservoir and show top emojis
- db:terms — summarize SourceItem terms in DB

