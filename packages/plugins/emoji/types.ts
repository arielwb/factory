export type ReservoirRow = {
  text: string;
  url: string;
  lang?: string;
  created_at?: string;
};

export type DiscoveryItem = {
  id: string;
  text: string;
  lang?: string;
  source: string;
  url: string;
  ts?: string;
  meta?: Record<string, any>;
};

export interface Provider {
  name: string;
  fetch(params: { since?: Date; limit?: number }): Promise<DiscoveryItem[]>;
}
