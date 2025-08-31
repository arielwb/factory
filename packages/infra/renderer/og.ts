import type { Renderer, Storage } from "@factory/core/ports";
import { renderOgCardImage } from "@factory/lib/render/og";

export function createRenderer(storage: Storage): Renderer {
  return {
    async renderOgCard(input) {
      const buf = await renderOgCardImage(input);
      const key = `og/${input.slug}.png`;
      await storage.put(key, buf, "image/png");
      return { key };
    }
  };
}

