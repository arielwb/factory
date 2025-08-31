import { emojiPlugin } from "@factory/plugins/emoji";
import type { NichePlugin } from "@factory/core/plugins";

export const registry: Record<string, NichePlugin> = {
  emoji: emojiPlugin
};

