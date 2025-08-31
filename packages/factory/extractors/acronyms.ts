import type { Reservoir } from '@factory/core/types';

const STOPLIST = new Set<string>([
  'USA','HTTP','CPU','GPU','API','WWW','COVID','NASA','FBI','CIA','UK','EU','NBA','FIFA','UFC','SSN','DOB','ETA','DIY'
]);

export type AcronymCandidate = { term: string; score: number; evidence: string[] };

export function extractAcronymCandidates(reservoir: Reservoir, topN = 20): AcronymCandidate[] {
  const counts = new Map<string, { hits: number; urls: Set<string> }>();
  const re = /\b[A-Z]{2,5}\b/g;
  for (const it of reservoir) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(it.text))) {
      const tok = m[0];
      if (STOPLIST.has(tok)) continue;
      const cur = counts.get(tok) ?? { hits: 0, urls: new Set<string>() };
      cur.hits += 1;
      if (it.url) cur.urls.add(it.url);
      counts.set(tok, cur);
    }
  }
  return [...counts.entries()]
    .map(([term, v]) => ({ term, score: v.hits, evidence: [...v.urls].slice(0,3) }))
    .sort((a,b)=>b.score-a.score)
    .slice(0, topN);
}

