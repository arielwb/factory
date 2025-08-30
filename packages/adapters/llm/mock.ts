import type { LLM, TDraftExplainer } from "@factory/core/ports";

export const llm: LLM = {
  async draftExplainer({ term, snippets }): Promise<TDraftExplainer> {
    const first = snippets[0] || "";
    return {
      title: `What does ${term} mean?`,
      summary: `Quick explainer for ${term}. ${first}`.trim(),
      sections: {
        meaning: `${term} typically represents a playful or contextual meaning.`,
        origin: `Derived from online usage and evolving meme culture.`,
        usage: [
          `I saw ${term} in a caption`,
          `${term} shows up in chats`,
          `People use ${term} for emphasis`
        ],
        variants: [],
        notes: undefined
      }
    } as TDraftExplainer;
  }
};

