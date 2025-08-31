📄 Document 2: Technical Plan
Architecture (MVP, JS-only)

Frontend: Next.js (static sites + MDX) on Vercel

DB: Neon Postgres + Prisma ORM

Storage: Backblaze B2 (S3-compatible) fronted by Cloudflare CDN

Queue: BullMQ + Upstash Redis

Workers: Node.js services run via GitHub Actions (cron) or Railway/Fly

Generation: OpenAI/Anthropic Node SDKs for explainers

Rendering: Puppeteer (cards), Sharp (images), fluent-ffmpeg (shorts)

Posting: Twitter via twitter-api-v2, Buffer/Later API for IG/TikTok

Analytics: Plausible (site), Sentry (errors), weekly KPI report

Scalability & Future-proofing

Config-driven niches (niches/*.config.ts) with:

Sources (scrapers)

Prompt template

Output schema

Scoring weights

Stateless workers, no local disk → easy to migrate to Cloud Run/AWS Lambda later.

S3-compatible storage → portable between B2 and AWS S3.

Modular pipeline: Ingest → Score → Generate → Publish → Distribute → Measure.

Ability to spin up a new niche in <1 day.

MVP Scope

1 niche live (Emoji explanations)

End-to-end automated pipeline:

Scrape trending emojis

Generate explanation JSON via LLM

Convert to MDX + publish static page

Render card image

Push to site + social via Buffer

Manual steps acceptable for MVP (e.g. approving drafts, uploading to TikTok).

Agile Tasks (MVP first)
Epic 1: Core Setup

 Scaffold monorepo (pnpm + Next.js site + worker app)

 Configure Neon + Prisma schema (Posts, SourceItems, Jobs)

 Configure B2 storage + Cloudflare CDN

 Set up GitHub Actions cron (6h job)

Epic 2: Niche Config (Emoji)

 Write niches/emoji.config.ts with sources + prompts

 Implement scraper for trending emoji (Twitter/TikTok captions)

 Write LLM generator → JSON → MDX converter

 Implement Puppeteer card renderer

 Implement publish to Next.js site

Epic 3: Distribution

 Create Buffer API integration for IG/TikTok scheduling

 Create Twitter/X poster with twitter-api-v2

 Add Plausible analytics to site

Epic 4: QA + Launch

 Manual test: 5 emoji posts end-to-end

 Deploy to Vercel, link custom domain

 Sanity check SEO (titles, metadata, sitemap)

 Publish 1 TikTok + 1 Twitter post with UTM links

 Validate traffic flows into analytics

Epic 5: Iteration

 Add related-term internal linking in MDX

 Weekly KPI email report (views, revenue, CTR)

 Add moderation queue for drafts before publishing

 Expand to Acronyms niche with new config

Timeline

Week 1: Repo setup, DB, first scraper, first draft post manually deployed.

Week 2: Full emoji pipeline automated (ingest → publish → distribute).

Week 3: Analytics + KPI reporting, manual iteration.

Week 4: Add Acronyms niche, test scaling with 2 sites.

Month 2–3: Evaluate KPIs → keep/kill/expand.

This gives you:

A business-facing doc (vision, niches, KPIs, financials).

A technical-facing doc (architecture, MVP tasks, future-proofing).