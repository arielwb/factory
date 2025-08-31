import type { NextApiRequest, NextApiResponse } from 'next';
import { buildReservoir } from '@factory/plugins/emoji/lib/reservoir';
import { topEmojisFromReservoir } from '@factory/plugins/emoji/lib/discover';

const ACR_STOP = new Set<string>([
  'USA','HTTP','CPU','GPU','API','WWW','COVID','NASA','FBI','CIA','UK','EU','NBA','FIFA','UFC','SSN','DOB','ETA','DIY'
]);

function extractAcronyms(text: string): string[] {
  const out = new Set<string>();
  const re = /\b[A-Z]{2,5}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tok = m[0];
    if (ACR_STOP.has(tok)) continue;
    out.add(tok);
  }
  return [...out];
}

export default async function handler(_req: NextApiRequest, res: NextApiResponse) {
  try {
    const rows = await buildReservoir(300);
    const emojis = await topEmojisFromReservoir(rows);
    const topEmojis = emojis.slice(0, 10).map(e => ({ emoji: e.emoji, freq: e.freq, score: Number(e.score.toFixed(2)) }));
    const counts = new Map<string, number>();
    for (const r of rows) {
      for (const tok of extractAcronyms(r.text || '')) counts.set(tok, (counts.get(tok) ?? 0) + 1);
    }
    const topAcronyms = [...counts.entries()].sort((a,b)=>b[1]-a[1]).slice(0, 10).map(([term,count])=>({term, count}));
    const providers = (process.env.DISCOVER_PROVIDERS || '').split(',').map(s=>s.trim()).filter(Boolean);
    res.status(200).json({ providers, reservoirRows: rows.length, topEmojis, topAcronyms });
  } catch (e: any) {
    res.status(500).json({ ok:false, error: e?.message || String(e) });
  }
}

