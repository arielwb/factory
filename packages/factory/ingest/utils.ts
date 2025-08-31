import { createHash } from "crypto";
import { promises as fs } from "fs";
import { resolve, dirname } from "path";
import { z } from "zod";
import { SourceItem, TSourceItem } from "@factory/core/ports";

export const Flags = z.object({
  live: z.boolean().default(false),
  limit: z.number().int().positive().default(10),
  nocache: z.boolean().default(false)
});
export type TFlags = z.infer<typeof Flags>;

export function parseFlags(argv: string[]): TFlags {
  const out: any = {};
  for (const a of argv) {
    if (a === "--live") out.live = true;
    if (a === "--mock") out.live = false;
    if (a.startsWith("--limit=")) out.limit = Number(a.split("=")[1] || 0);
    if (a === "--nocache") out.nocache = true;
  }
  return Flags.parse(out);
}

export async function withCache<T>(filename: string, fn: () => Promise<T>, nocache = false): Promise<T> {
  const file = resolve(process.cwd(), "data/fixtures", filename);
  if (!nocache) {
    try {
      const raw = await fs.readFile(file, "utf8");
      return JSON.parse(raw) as T;
    } catch {}
  }
  const fresh = await fn();
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(fresh, null, 2));
  return fresh;
}

export function hashId(input: string): string {
  return createHash("sha1").update(input).digest("hex");
}

export function normalizeEmoji(term: string): string {
  return term?.trim() || "";
}

export function detectLang(text: string): "en" | "pt" {
  // Naive heuristic: if contains common Portuguese accents, mark pt
  if (/[áéíóúãõâêôç]/i.test(text)) return "pt";
  return "en";
}

export function validateItems(items: any[]): TSourceItem[] {
  const result: TSourceItem[] = [];
  items.forEach((it, i) => {
    const r = SourceItem.safeParse(it);
    if (!r.success) {
      const issue = r.error.issues[0];
      throw new Error(`Invalid item[${i}] ${issue.path.join(".")}: ${issue.message}`);
    }
    result.push(r.data);
  });
  return result;
}

export function dedupe(items: TSourceItem[]): TSourceItem[] {
  const seen = new Set<string>();
  const out: TSourceItem[] = [];
  for (const it of items) {
    const key = it.id;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(it);
  }
  return out;
}
