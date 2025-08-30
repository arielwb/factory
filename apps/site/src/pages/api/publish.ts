import type { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const id = (req.method === "POST" ? (req.body?.id as string) : (req.query.id as string)) || "";
    if (!id) {
      res.status(400).json({ ok: false, error: "Missing id" });
      return;
    }
    await prisma.post.update({ where: { id }, data: { status: "published", publishedAt: new Date() } });
    res.status(200).json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || String(err) });
  }
}

