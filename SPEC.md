Goal

Build a local-first, cloud-ready content factory for “explainer” posts. Same code runs in dev & prod; only adapters (DB/storage/LLM/posters) change by env.

Tech constraints

Language: TypeScript (Node 18+)

Framework: Next.js (SSR; no MDX files required for MVP)

DB: Prisma with SQLite (dev) and Postgres (prod-ready)

Storage: filesystem (dev) and S3-compatible (B2) (prod)

Queue: in-memory (dev) and BullMQ + Redis (prod-ready, but optional to start)

LLM: mock (dev) and OpenAI (prod-ready)

Posters: mock (dev) and twitter-api-v2 + Buffer (prod-ready)

Rendering: Puppeteer (OG cards)

Repository layout
meme-factory/
  apps/
    site/                  # Next.js frontend + admin
    worker/                # Node CLI for pipeline steps
  packages/
    core/                  # types, ports (interfaces), constants
    infra/                 # DI container: env -> choose adapters
    adapters/
      db/                  # prisma-sqlite.ts, prisma-postgres.ts
      storage/             # fs-local.ts, s3-b2.ts
      queue/               # memory.ts, bullmq-upstash.ts (optional)
      llm/                 # mock.ts, openai.ts
      render/              # puppeteer-og.ts
      poster/              # mock.ts, twitter.ts, buffer.ts
      analytics/           # console.ts, plausible.ts
    features/
      ingest/              # source fetchers + normalizers
      generate/            # drafts via LLM
      publish/             # write to DB, mark published
      distribute/          # create post payloads, (later) send
      report/              # KPI summaries
  prisma/
    schema.prisma
  data/
    media/                 # local images (gitignored)
    fixtures/              # sample inputs/outputs for tests
  .env.local               # local envs
  SPEC.md                  # this file

Env contract (single truth)
# mode
ENV=local|staging|prod

# db
DB_DRIVER=sqlite|postgres
DATABASE_URL=file:./data/dev.db  # local sqlite
# DATABASE_URL=postgres://user:pass@host/db  # staging/prod

# storage
STORAGE_DRIVER=fs|s3
S3_ENDPOINT=https://s3.eu-xxxx.backblazeb2.com
S3_REGION=auto
S3_BUCKET=meme-factory
S3_ACCESS_KEY=xxx
S3_SECRET_KEY=yyy

# queue (optional for MVP)
QUEUE_DRIVER=memory|bullmq
REDIS_URL=rediss://...

# llm
LLM_DRIVER=mock|openai
OPENAI_API_KEY=sk-...

# posters
POSTER_DRIVER=mock|live
TWITTER_BEARER=...
BUFFER_TOKEN=...

# analytics
ANALYTICS_DRIVER=console|plausible
PLAUSIBLE_DOMAIN=example.com
PLAUSIBLE_API_KEY=...

Prisma schema (authoritative model)

/prisma/schema.prisma

datasource db { provider = "sqlite"; url = env("DATABASE_URL") }
generator client { provider = "prisma-client-js" }

model SourceItem {
  id          String   @id @default(cuid())
  niche       String
  term        String
  lang        String
  text        String
  sourceUrl   String
  likes       Int      @default(0)
  shares      Int      @default(0)
  comments    Int      @default(0)
  firstSeenAt DateTime
  mediaUrl    String?
  createdAt   DateTime @default(now())
}

model Post {
  id          String   @id @default(cuid())
  niche       String
  slug        String   @unique
  title       String
  summary     String
  contentHtml String   // keep HTML string for MVP; switch to MDX later if desired
  ogImageKey  String?  // path or s3 key
  status      String   @default("draft") // draft|approved|published
  publishedAt DateTime?
  createdAt   DateTime @default(now())
}

Ports (stable interfaces)

/packages/core/ports.ts

import { z } from "zod";

export const SourceItem = z.object({
  id: z.string(), niche: z.string(), term: z.string(), lang: z.string(),
  text: z.string(), sourceUrl: z.string().url(),
  likes: z.number(), shares: z.number(), comments: z.number(),
  firstSeenAt: z.coerce.date(), mediaUrl: z.string().url().nullish()
});
export type TSourceItem = z.infer<typeof SourceItem>;

export const DraftExplainer = z.object({
  title: z.string(), summary: z.string(),
  sections: z.object({
    meaning: z.string(),
    origin: z.string(),
    usage: z.array(z.string()).max(3),
    variants: z.array(z.string()).optional(),
    notes: z.string().optional()
  })
});
export type TDraftExplainer = z.infer<typeof DraftExplainer>;

export interface DB {
  upsertSourceItems(items: TSourceItem[]): Promise<void>;
  queueTopNForDraft(niche: string, n: number): Promise<TSourceItem[]>;
  createDraftPost(p: {
    niche: string; slug: string; title: string; summary: string; contentHtml: string; ogImageKey?: string;
  }): Promise<{ id: string; slug: string }>;
  listDrafts(): Promise<{ id: string; slug: string; title: string }[]>;
  publishPost(id: string): Promise<void>;
  getPostBySlug(slug: string): Promise<any | null>;
}

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<{ key: string }>;
  url(key: string): string; // return public url OR file:// path in local
}

export interface Queue {
  enqueue(name: string, payload: any): Promise<void>;
  process(name: string, handler: (payload: any) => Promise<void>): void;
}

export interface LLM {
  draftExplainer(input: { term: string; snippets: string[]; language: "en"|"pt" }): Promise<z.infer<typeof DraftExplainer>>;
}

export interface Renderer {
  renderOgCard(input: { title: string; summary: string; slug: string }): Promise<{ key: string }>;
}

export interface Poster {
  planPost(input: { platform: "twitter"|"tiktok"|"instagram"; text: string; url: string; mediaKey?: string }): Promise<void>;
}

export interface Analytics {
  track(event: string, props?: Record<string, any>): Promise<void>;
}

DI container (one file decides adapters)

/packages/infra/container.ts

import type { DB, Storage, Queue, LLM, Renderer, Poster, Analytics } from "@factory/core/ports";

export function container() {
  const env = process.env;

  const db: DB = env.DB_DRIVER === "postgres"
    ? require("@factory/adapters/db/prisma-postgres").db
    : require("@factory/adapters/db/prisma-sqlite").db;

  const storage: Storage = env.STORAGE_DRIVER === "s3"
    ? require("@factory/adapters/storage/s3-b2").storage
    : require("@factory/adapters/storage/fs-local").storage;

  const queue: Queue = env.QUEUE_DRIVER === "bullmq"
    ? require("@factory/adapters/queue/bullmq-upstash").queue
    : require("@factory/adapters/queue/memory").queue;

  const llm: LLM = env.LLM_DRIVER === "openai"
    ? require("@factory/adapters/llm/openai").llm
    : require("@factory/adapters/llm/mock").llm;

  const renderer: Renderer = require("@factory/adapters/render/puppeteer-og").renderer;

  const poster: Poster = env.POSTER_DRIVER === "live"
    ? require("@factory/adapters/poster/twitter").poster
    : require("@factory/adapters/poster/mock").poster;

  const analytics: Analytics = env.ANALYTICS_DRIVER === "plausible"
    ? require("@factory/adapters/analytics/plausible").analytics
    : require("@factory/adapters/analytics/console").analytics;

  return { db, storage, queue, llm, renderer, poster, analytics };
}

Minimal feature flows (must exist)
Ingest (emoji, mock first)

Input: none

Output: SourceItem[] written via db.upsertSourceItems

File: /packages/features/ingest/emoji.mock.ts returns fixed array of 3 items

Select/Score

Function: queueTopNForDraft(niche, n) inside DB adapter (simple ORDER BY likes+shares+recency)

Generate drafts

Use llm.draftExplainer → build contentHtml from sections

Create slug what-does-<term>-mean (sanitize emoji → “goose” fallback)

Save via db.createDraftPost

Render OG

renderer.renderOgCard({ title, summary, slug }) → returns ogImageKey

Update Post.OG

Publish

db.publishPost(id) sets status & date

Distribute (mock)

poster.planPost({ platform:"twitter", text, url, mediaKey }) → write JSON log in local mode

