import type { Renderer } from "@factory/core/ports";
import { storage } from "@factory/adapters/storage/fs-local";

// 1x1 transparent PNG
const TRANSPARENT_PNG_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8Xw8AAgMBB00r8m4AAAAASUVORK5CYII=";

export const renderer: Renderer = {
  async renderOgCard(input) {
    const key = `og/${input.slug}.png`;
    const png = Buffer.from(TRANSPARENT_PNG_BASE64, "base64");
    await storage.put(key, png, "image/png");
    return { key };
  }
};

