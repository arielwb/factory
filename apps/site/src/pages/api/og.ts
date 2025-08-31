import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream, existsSync } from "fs";
import { resolve } from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = String(req.query.key || "");
  const candidates = [
    resolve(process.cwd(), "..", "..", "data/media", key),
    resolve(process.cwd(), "data/media", key)
  ];
  const file = candidates.find((p) => existsSync(p));
  if (!file) {
    res.status(404).json({ ok: false, error: "OG image not found", key });
    return;
  }
  res.setHeader("Content-Type", "image/png");
  createReadStream(file).pipe(res);
}
