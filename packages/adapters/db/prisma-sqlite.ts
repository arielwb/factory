import type { DB, TSourceItem } from "@factory/core/ports";
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const db: DB = {
  async upsertSourceItems(items) {
    for (const item of items) {
      await prisma.sourceItem.upsert({
        where: { id: item.id },
        update: {
          niche: item.niche,
          term: item.term,
          lang: item.lang,
          text: item.text,
          sourceUrl: item.sourceUrl,
          likes: item.likes,
          shares: item.shares,
          comments: item.comments,
          firstSeenAt: new Date(item.firstSeenAt),
          mediaUrl: item.mediaUrl ?? null
        },
        create: {
          id: item.id,
          niche: item.niche,
          term: item.term,
          lang: item.lang,
          text: item.text,
          sourceUrl: item.sourceUrl,
          likes: item.likes,
          shares: item.shares,
          comments: item.comments,
          firstSeenAt: new Date(item.firstSeenAt),
          mediaUrl: item.mediaUrl ?? null
        }
      });
    }
  },

  async queueTopNForDraft(niche, n) {
    const now = new Date();
    return await prisma.$transaction(async (tx) => {
      // Fetch recent published posts for basic novelty penalty
      const recentPosts = await tx.post.findMany({
        where: { niche },
        select: { id: true, title: true, slug: true },
        orderBy: { createdAt: "desc" },
        take: 200
      });

      // Get candidates that are not queued yet
      const candidates = await tx.sourceItem.findMany({
        where: { niche, queuedAt: null },
        orderBy: [
          { likes: "desc" },
          { shares: "desc" },
          { comments: "desc" },
          { firstSeenAt: "desc" }
        ],
        take: Math.max(n * 5, 50)
      });

      // Load simple history for novelty boost
      let history: Record<string, number[]> = {};
      try { history = JSON.parse(await fs.readFile(resolve(process.cwd(), 'data/fixtures/history.json'), 'utf8')); } catch {}

      // Score: engagement (log), recency decay, novelty penalty if term seen in a post title + small novelty boost if unseen in history
      const scored = candidates.map((s) => {
        const ageHours = Math.max(0, (now.getTime() - new Date(s.firstSeenAt).getTime()) / 36e5);
        const engagement = Math.log10(1 + s.likes) + 2 * Math.log10(1 + s.shares) + 1.5 * Math.log10(1 + s.comments);
        const recency = Math.exp(-ageHours / 48) * 3; // decays over ~2 days
        const seen = recentPosts.some((p) => (p.title || "").includes(s.term));
        const novelty = seen ? -5 : 0;
        const noveltyBoost = history[s.term] ? 0 : 2;
        const score = engagement + recency + novelty + noveltyBoost;
        return { s, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, n)
      .map((x) => x.s);

      if (scored.length === 0) return [] as unknown as TSourceItem[];

      // Mark selected as queued (idempotent)
      const ids = scored.map((x) => x.id);
      await tx.sourceItem.updateMany({ where: { id: { in: ids }, queuedAt: null }, data: { queuedAt: now } });

      return scored as unknown as TSourceItem[];
    });
  },

  async createDraftPost(p) {
    const existing = await prisma.post.findUnique({ where: { slug: p.slug } });
    if (existing) return { id: existing.id, slug: existing.slug };
    const created = await prisma.post.create({
      data: {
        niche: p.niche,
        slug: p.slug,
        title: p.title,
        summary: p.summary,
        contentHtml: p.contentHtml,
        ogImageKey: p.ogImageKey ?? null,
        status: "draft"
      },
      select: { id: true, slug: true }
    });
    return created;
  },

  async listDrafts() {
    const drafts = await prisma.post.findMany({
      where: { status: "draft" },
      orderBy: { createdAt: "asc" },
      select: { id: true, slug: true, title: true }
    });
    return drafts;
  },

  async publishPost(id) {
    await prisma.post.update({
      where: { id },
      data: { status: "published", publishedAt: new Date() }
    });
  },

  async getPostBySlug(slug) {
    return prisma.post.findUnique({ where: { slug } });
  },

  async listPublishedSince(minutes: number) {
    const since = new Date(Date.now() - Math.max(1, minutes) * 60_000);
    const posts = await prisma.post.findMany({
      where: { status: "published", publishedAt: { gte: since } },
      orderBy: { publishedAt: "desc" },
      select: { id: true, slug: true, title: true, summary: true, ogImageKey: true }
    });
    return posts as any;
  }
};
