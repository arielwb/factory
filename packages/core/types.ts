export type Source = "reddit" | "hn" | "trends" | "youtube" | "rss" | "news" | "ud" | "quora" | "paa";

export interface DiscoveryItem {
  id: string;
  text: string;
  url?: string;
  lang?: "en" | "pt" | "other" | string;
  ts: number; // epoch ms
  source: Source;
  meta?: Record<string, unknown>;
}

export type Reservoir = DiscoveryItem[];

