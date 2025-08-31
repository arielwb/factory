import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { promises as fs } from "fs";
import { resolve, dirname } from "path";

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = (req.query.id as string) || (req.body?.id as string) || "";
    if (!id) {
      res.status(400).json({ ok: false, error: "Missing id" });
      return;
    }
    const prisma = new PrismaClient();
    const updated = await prisma.post.update({ where: { id }, data: { status: "published", publishedAt: new Date() }, select: { id: true, slug: true, publishedAt: true } });

    // Append a publish event to a local JSONL outbox for the worker to process
    try {
      const eventsFile = resolve(process.cwd(), "..", "..", "data", "events", "published.jsonl");
      await fs.mkdir(dirname(eventsFile), { recursive: true });
      const line = JSON.stringify({ id: updated.id, slug: updated.slug, at: updated.publishedAt || new Date() }) + "\n";
      await fs.appendFile(eventsFile, line, "utf8");
    } catch {}

    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}
