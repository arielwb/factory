import type { NextApiRequest, NextApiResponse } from 'next';
import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }
  try {
    const eventsFile = resolve(process.cwd(), '..', '..', 'data', 'events', 'tasks.jsonl');
    await fs.mkdir(dirname(eventsFile), { recursive: true });
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const { type, payload } = body || {};
    if (!type) {
      res.status(400).json({ ok: false, error: 'Missing type' });
      return;
    }
    const ev = { id: `${type}_${Date.now()}`, type, payload: payload || {}, at: new Date().toISOString() };
    await fs.appendFile(eventsFile, JSON.stringify(ev) + '\n', 'utf8');
    res.status(200).json({ ok: true, id: ev.id });
  } catch (e: any) {
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
}

