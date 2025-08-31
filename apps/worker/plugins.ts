import { emojiPlugin } from "@factory/plugins/emoji";
import { acronymsPlugin } from "@factory/plugins/acronyms";
import type { NichePlugin } from "@factory/core/plugins";

export const registry: Record<string, NichePlugin> = {
  emoji: emojiPlugin,
  acronyms: acronymsPlugin
};
