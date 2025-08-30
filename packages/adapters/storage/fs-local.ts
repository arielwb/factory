import { promises as fs } from "fs";
import { resolve, dirname } from "path";
import type { Storage } from "@factory/core/ports";

export const storage: Storage = {
  async put(key, body, _contentType) {
    const full = resolve(process.cwd(), "data/media", key);
    await fs.mkdir(dirname(full), { recursive: true });
    await fs.writeFile(full, body);
    return { key };
  },
  url(key) {
    return `/api/og?key=${encodeURIComponent(key)}`;
  }
};

