import type { DB, TSourceItem } from "@factory/core/ports";
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
    const items = await prisma.sourceItem.findMany({
      where: { niche },
      orderBy: [
        { likes: "desc" },
        { shares: "desc" },
        { comments: "desc" },
        { firstSeenAt: "desc" }
      ],
      take: n
    });
    // Cast to TSourceItem-like shape (Prisma returns Date, strings as expected)
    return items as unknown as TSourceItem[];
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
  }
};
