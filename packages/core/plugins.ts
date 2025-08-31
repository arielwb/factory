import type { TSourceItem, TDraftExplainer } from "./ports";

export interface NichePlugin {
  name: string;
  discover(params: { limit: number; live: boolean }): Promise<TSourceItem[]>;
  scoreHint?(item: TSourceItem): number;
  buildPrompt(input: { item: TSourceItem }): {
    system: string;
    user: string;
  };
  slugFor?(item: TSourceItem): string;
  titleFor?(draft: TDraftExplainer): string;
}

