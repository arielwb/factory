import type { DB, TSourceItem } from "@factory/core/ports";

function notImpl(): never {
  throw new Error("@factory/adapters/db/prisma-postgres is not implemented in this scaffold. Set DB_DRIVER=sqlite or ask to implement the Postgres adapter.");
}

export const db: DB = {
  async upsertSourceItems(_items: TSourceItem[]): Promise<void> { notImpl(); },
  async queueTopNForDraft(_niche: string, _n: number) { return notImpl(); },
  async createDraftPost(_p: { niche: string; slug: string; title: string; summary: string; contentHtml: string; ogImageKey?: string; }) { return notImpl(); },
  async listDrafts() { return notImpl(); },
  async publishPost(_id: string) { return notImpl(); },
  async getPostBySlug(_slug: string) { return notImpl(); },
  async listPublishedSince(_minutes: number) { return notImpl(); }
};
