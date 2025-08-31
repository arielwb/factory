import type { NichePlugin } from "@factory/core/plugins";
import type { TSourceItem } from "@factory/core/ports";
import { buildReservoir } from "@factory/plugins/emoji/lib/reservoir";
import { extractAcronymCandidates } from "@factory/factory/extractors/acronyms";

export const acronymsPlugin: NichePlugin = {
  name: "acronyms",
  async discover({ limit, live }): Promise<TSourceItem[]> {
    // live flag not used here; discovery uses non‑X reservoir providers via env
    const rows = await buildReservoir(600);
    const cands = extractAcronymCandidates(rows as any, limit || 20);
    const now = new Date();
    const items: TSourceItem[] = cands.flatMap((c, idx) => c.evidence.map((url, i) => ({
      id: `acr:${c.term}:${idx}:${i}`,
      niche: "acronyms",
      term: c.term,
      lang: "en",
      text: `${c.term} meaning — from discovery reservoir`,
      sourceUrl: url,
      likes: 0,
      shares: 0,
      comments: 0,
      firstSeenAt: now
    }))) as any;
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
