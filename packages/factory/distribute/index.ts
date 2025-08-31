import type { DB, Poster } from "@factory/core/ports";

export async function distributeRecent(opts: {
  db: DB;
  poster: Poster;
  siteOrigin: string;
  sinceMinutes?: number;
  platform?: "twitter" | "tiktok" | "instagram";
}) {
  const { db, poster, siteOrigin } = opts;
  const since = opts.sinceMinutes ?? Number(process.env.DISTRIBUTE_SINCE_MINUTES || 1440);
  const platform = opts.platform || "twitter";
  const posts = await db.listPublishedSince(since);
  for (const p of posts) {
    const url = joinUrl(siteOrigin, `/${p.slug}`);
    const text = `${p.title} ${url}`.trim();
    await poster.planPost({ platform, text, url, mediaKey: p.ogImageKey || undefined });
  }
  return posts.map((p) => p.slug);
}

function joinUrl(base: string, path: string) {
  return `${base.replace(/\/$/, "")}${path}`;
}

