import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import { resolve } from 'path';

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const file = resolve(process.cwd(), '..', '..', 'data', 'fixtures', 'reservoir-health.json');
    const raw = await fs.readFile(file, 'utf8');
    res.status(200).json(JSON.parse(raw));
  } catch {
    res.status(200).json({});
  }
}

