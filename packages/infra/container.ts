import type { DB, Storage, Queue, LLM, Renderer, Poster, Analytics } from "@factory/core/ports";

export function container(): { db: DB; storage: Storage; queue: Queue; llm: LLM; renderer: Renderer; poster: Poster; analytics: Analytics } {
  const env = process.env;

  const db: DB = env.DB_DRIVER === "postgres"
    ? require("@factory/adapters/db/prisma-postgres").db // placeholder; not implemented in local scaffold
    : require("@factory/adapters/db/prisma-sqlite").db;

  const storage: Storage = env.STORAGE_DRIVER === "s3"
    ? require("@factory/adapters/storage/s3-b2").storage // placeholder; not implemented in local scaffold
    : require("@factory/adapters/storage/fs-local").storage;

  const queue: Queue = env.QUEUE_DRIVER === "bullmq"
    ? require("@factory/adapters/queue/bullmq-upstash").queue // placeholder; not implemented in local scaffold
    : require("@factory/adapters/queue/memory").queue;

  const llm: LLM = env.LLM_DRIVER === "openai"
    ? require("@factory/adapters/llm/openai").llm // placeholder; not implemented in local scaffold
    : require("@factory/adapters/llm/mock").llm;

  const renderer: Renderer = require("@factory/adapters/render/puppeteer-og").renderer;

  const poster: Poster = env.POSTER_DRIVER === "live"
    ? require("@factory/adapters/poster/twitter").poster // placeholder; not implemented in local scaffold
    : require("@factory/adapters/poster/mock").poster;

  const analytics: Analytics = env.ANALYTICS_DRIVER === "plausible"
    ? require("@factory/adapters/analytics/plausible").analytics // placeholder; not implemented in local scaffold
    : require("@factory/adapters/analytics/console").analytics;

  return { db, storage, queue, llm, renderer, poster, analytics };
}

