import type { DB, Storage, Queue, LLM, Renderer, Poster, Analytics } from "@factory/core/ports";

export async function container(): Promise<{ db: DB; storage: Storage; queue: Queue; llm: LLM; renderer: Renderer; poster: Poster; analytics: Analytics }> {
  const env = process.env;

  // Dynamic imports avoid bundlers resolving unused drivers
  const db: DB = env.DB_DRIVER === "postgres"
    ? (await import("@factory/adapters/db/prisma-postgres")).db
    : (await import("@factory/adapters/db/prisma-sqlite")).db;

  const storage: Storage = env.STORAGE_DRIVER === "s3"
    ? (await import("@factory/adapters/storage/s3-b2")).storage
    : (await import("@factory/adapters/storage/fs-local")).storage;

  const queue: Queue = env.QUEUE_DRIVER === "bullmq"
    ? (await import("@factory/adapters/queue/bullmq-upstash")).queue
    : (await import("@factory/adapters/queue/memory")).queue;

  const llm: LLM = env.LLM_DRIVER === "openai"
    ? (await import("@factory/adapters/llm/openai")).llm
    : (await import("@factory/adapters/llm/mock")).llm;

  const { createRenderer } = await import("@factory/infra/renderer/og");
  const renderer: Renderer = createRenderer(storage);

  const poster: Poster = env.POSTER_DRIVER === "live"
    ? (await import("@factory/adapters/poster/twitter")).poster
    : (await import("@factory/adapters/poster/mock")).poster;

  const analytics: Analytics = env.ANALYTICS_DRIVER === "plausible"
    ? (await import("@factory/adapters/analytics/plausible")).analytics
    : (await import("@factory/adapters/analytics/console")).analytics;

  return { db, storage, queue, llm, renderer, poster, analytics };
}
