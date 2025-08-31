export function normalizeText(input: string): string {
  return input
    .replace(/<[^>]+>/g, ' ') // strip HTML
    .replace(/\s+/g, ' ') // collapse
    .trim()
    .slice(0, 240);
}

export function retry<T>(fn: () => Promise<T>, attempts = 3, baseMs = 500): Promise<T> {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const run = () => {
      tries++;
      fn().then(resolve).catch((err) => {
        if (tries >= attempts) return reject(err);
        const wait = Math.round(baseMs * Math.pow(2, tries - 1) * (0.9 + Math.random() * 0.2));
        setTimeout(run, wait);
      });
    };
    run();
  });
}

export function similarity(a: string, b: string): number {
  // Simple Jaccard over word sets for MVP
  const A = new Set(a.toLowerCase().split(/\W+/).filter(Boolean));
  const B = new Set(b.toLowerCase().split(/\W+/).filter(Boolean));
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

export function dedupeByUrlAndSimilarity<T extends { url: string; text: string }>(rows: T[], simThreshold = 0.9): T[] {
  const out: T[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (seen.has(r.url)) continue;
    let dup = false;
    for (const o of out) {
      if (similarity(r.text, o.text) >= simThreshold) { dup = true; break; }
    }
    if (dup) continue;
    seen.add(r.url);
    out.push(r);
  }
  return out;
}

