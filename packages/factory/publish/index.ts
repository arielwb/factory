import type { DB } from "@factory/core/ports";

export async function publishById(db: DB, id: string): Promise<void> {
  await db.publishPost(id);
}

