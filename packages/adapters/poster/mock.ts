import { promises as fs } from "fs";
import { resolve, dirname } from "path";
import type { Poster } from "@factory/core/ports";

const OUTBOX = resolve(process.cwd(), "data/outbox/social.json");

export const poster: Poster = {
  async planPost(input) {
    await fs.mkdir(dirname(OUTBOX), { recursive: true });
    let existing: any[] = [];
    try {
      existing = JSON.parse(await fs.readFile(OUTBOX, "utf8"));
    } catch {}
    existing.push({ ...input, plannedAt: new Date().toISOString() });
    await fs.writeFile(OUTBOX, JSON.stringify(existing, null, 2));
  }
};

