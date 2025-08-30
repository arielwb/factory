import type { NextApiRequest, NextApiResponse } from "next";
import { createReadStream } from "fs";
import { resolve } from "path";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const key = String(req.query.key || "");
  const file = resolve(process.cwd(), "data/media", key);
  createReadStream(file).pipe(res);
}

