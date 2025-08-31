import type { NichePlugin } from "@factory/core/plugins";
import type { TSourceItem } from "@factory/core/ports";
import { buildReservoir } from "@factory/plugins/emoji/lib/reservoir";

const STOPLIST = new Set<string>([
  "USA","HTTP","CPU","GPU","API","WWW","COVID","NASA","FBI","CIA","UK","EU","NBA","FIFA","UFC","SSN","DOB","DOB","ETA","DIY"
]);

function extractAcronyms(text: string): string[] {
  const out = new Set<string>();
  const re = /\b[A-Z]{2,5}\b/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) {
    const tok = m[0];
    if (STOPLIST.has(tok)) continue;
    out.add(tok);
  }
  return [...out];
}

export const acronymsPlugin: NichePlugin = {
  name: "acronyms",
  async discover({ limit, live }): Promise<TSourceItem[]> {
    // live flag not used here; discovery uses non‑X reservoir providers via env
    const rows = await buildReservoir(600);
    const terms = new Map<string, { term: string; samples: { text: string; url: string; lang?: string }[] }>();
    for (const r of rows) {
      const toks = extractAcronyms(r.text || "");
      for (const t of toks) {
        const e = terms.get(t) || { term: t, samples: [] };
        if (e.samples.length < 3) e.samples.push({ text: r.text, url: r.url, lang: r.lang });
        terms.set(t, e);
      }
    }
    // Rank by number of samples (proxy for frequency)
    const ranked = [...terms.values()].sort((a,b)=>b.samples.length - a.samples.length);
    const picked = (limit ? ranked.slice(0, limit) : ranked).flatMap(v => v.samples.map(s => ({ term: v.term, sample: s })));
    const now = new Date();
    const items: TSourceItem[] = picked.map((p, i) => ({
      id: `acr:${p.term}:${i}:${Buffer.from(p.sample.url).toString('base64').slice(0,12)}`,
      niche: "acronyms",
      term: p.term,
      lang: (p.sample.lang as any) || "en",
      text: p.sample.text,
      sourceUrl: p.sample.url,
      likes: 0,
      shares: 0,
      comments: 0,
      firstSeenAt: now
    })) as any;
    return items;
  },
  scoreHint() { return 0.1; },
  buildPrompt({ item }) {
    const system = "You write concise acronym explainers with sections: meaning (expanded form), usage (2), notes. Output strict JSON per schema.";
    const userObj = {
      niche: "acronyms",
      term: item.term,
      snippets: [item.text],
      sources: [item.sourceUrl],
      language: item.lang
    };
    return { system, user: JSON.stringify(userObj) };
  },
  slugFor(item) {
    return `what-does-${item.term.toLowerCase()}-mean`;
  }
};

