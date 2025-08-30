import { z } from "zod";

export const SourceItem = z.object({
  id: z.string(),
  niche: z.string(),
  term: z.string(),
  lang: z.string(),
  text: z.string(),
  sourceUrl: z.string().url(),
  likes: z.number(),
  shares: z.number(),
  comments: z.number(),
  firstSeenAt: z.coerce.date(),
  mediaUrl: z.string().url().nullish()
});
export type TSourceItem = z.infer<typeof SourceItem>;

export const DraftExplainer = z.object({
  title: z.string(),
  summary: z.string(),
  sections: z.object({
    meaning: z.string(),
    origin: z.string(),
    usage: z.array(z.string()).max(3),
    variants: z.array(z.string()).optional(),
    notes: z.string().optional()
  })
});
export type TDraftExplainer = z.infer<typeof DraftExplainer>;

export interface DB {
  upsertSourceItems(items: TSourceItem[]): Promise<void>;
  queueTopNForDraft(niche: string, n: number): Promise<TSourceItem[]>;
  createDraftPost(p: {
    niche: string; slug: string; title: string; summary: string; contentHtml: string; ogImageKey?: string;
  }): Promise<{ id: string; slug: string }>;
  listDrafts(): Promise<{ id: string; slug: string; title: string }[]>;
  publishPost(id: string): Promise<void>;
  getPostBySlug(slug: string): Promise<any | null>;
}

export interface Storage {
  put(key: string, body: Buffer, contentType: string): Promise<{ key: string }>;
  url(key: string): string;
}

export interface Queue {
  enqueue(name: string, payload: any): Promise<void>;
  process(name: string, handler: (payload: any) => Promise<void>): void;
}

export interface LLM {
  draftExplainer(input: { term: string; snippets: string[]; language: "en" | "pt" }): Promise<TDraftExplainer>;
}

export interface Renderer {
  renderOgCard(input: { title: string; summary: string; slug: string }): Promise<{ key: string }>;
}

export interface Poster {
  planPost(input: { platform: "twitter" | "tiktok" | "instagram"; text: string; url: string; mediaKey?: string }): Promise<void>;
}

export interface Analytics {
  track(event: string, props?: Record<string, any>): Promise<void>;
}

