import type { NichePlugin } from "@factory/core/plugins";
import type { TSourceItem } from "@factory/core/ports";
import { discoverTopEmojis } from "./lib/discover";
import { fetchContextForEmoji } from "./lib/context";
import { toSourceItems } from "./lib/normalize";
import { buildReservoir } from "./lib/reservoir";
import { clip } from "./util/text";
import type { ReservoirRow } from "./types";
import { slugFromEmoji } from "./util/slug";
import { extractEmojiCandidates } from "@factory/factory/extractors/emoji";

function normalizeEmojiTerm(s: string) {
  return s?.trim() || "";
}

export const emojiPlugin: NichePlugin = {
  name: "emoji",
  async discover({ limit, live }): Promise<TSourceItem[]> {
    if (!live) {
      // Fallback: map fixtures directly to SourceItem for local dev
      const fixtures = await import("./fixtures.json").then(m => m.default as any[]);
      const now = new Date();
      return fixtures.map((r: any, i: number) => ({
        id: r.id?.startsWith("tw:") ? r.id : `tw:${r.id ?? i}`,
        niche: "emoji",
        term: normalizeEmojiTerm(r.term || "🪿"),
        lang: r.lang || "en",
        text: String(r.text || ""),
        sourceUrl: r.url || `https://twitter.com/i/web/status/${r.id}`,
        likes: r.likes ?? 0,
        shares: r.retweets ?? 0,
        comments: r.replies ?? 0,
        firstSeenAt: r.created_at ? new Date(r.created_at) : now,
        mediaUrl: r.mediaUrl
      })) as any;
    }

    const X_ENABLED = String(process.env.X_ENABLED || 'false') === 'true';
    const pages = Number(process.env.TW_PAGES || 5);
    const pageSize = Number(process.env.TW_PER_PAGE || 100);
    const perEmoji = Number(process.env.TW_PER_EMOJI || 20);
    const concurrency = Math.max(1, Number(process.env.TW_CONCURRENCY || 3));
    const tweetBudget = Math.max(1, Number(process.env.TW_BUDGET_TWEETS || 200));

    let emojis: string[] = [];
    const providers = (process.env.DISCOVER_PROVIDERS || '').trim();
    if (providers) {
      // Non-X discovery via reservoir + factory extractor
      const rows = await buildReservoir(400);
      const cands = extractEmojiCandidates(rows as any);
      emojis = (limit ? cands.slice(0, limit) : cands).map(c => c.emoji);
    } else if (X_ENABLED) {
      // X discovery fallback (if enabled)
      const top = await discoverTopEmojis({ live: true, samplePages: pages, samplePageSize: pageSize });
      emojis = (limit ? top.slice(0, limit) : top).map(t => t.emoji);
    } else {
      return [] as any;
    }

    const enrichers = (process.env.ENRICH_PROVIDERS || '').split(',').map(s => s.trim()).filter(Boolean);
    const all: any[] = [];

    if (X_ENABLED && enrichers.includes('x_context') && tweetBudget > 0) {
      const queue = [...emojis];
      let remaining = tweetBudget;
      async function worker() {
        while (queue.length > 0 && remaining > 0) {
          const emoji = queue.shift()!;
          const take = Math.min(perEmoji, Math.max(remaining, 0));
          if (take <= 0) break;
          const rows = await fetchContextForEmoji({ emoji, perEmoji: take });
          remaining -= rows.length;
          all.push(...rows);
        }
      }
      const workers = Array.from({ length: concurrency }, () => worker());
      await Promise.all(workers);
    } else {
      // Build context from reservoir directly (non-X): sample rows containing the emoji
      const rows = await buildReservoir(600);
      for (const emoji of emojis) {
        const sample = rows.filter(r => r.text.includes(emoji)).slice(0, perEmoji);
        for (const r of sample) {
          all.push({ id: r.url, emoji, text: clip(r.text, 200), url: r.url, created_at: r.created_at, metrics: { like_count: 0, retweet_count: 0, reply_count: 0 }, lang: r.lang || 'und' });
        }
      }
    }
    return toSourceItems(all);
  },
  scoreHint(item) {
    return [...item.term].length === 1 ? 0.2 : 0;
  },
  buildPrompt({ item }) {
    const system = "You write concise explainers with sections: meaning, origin, usage (2-3), variants, notes. Output strict JSON per schema.";
    const userObj = {
      niche: "emoji",
      term: item.term,
      snippets: [item.text],
      sources: [item.sourceUrl],
      language: item.lang
    };
    return { system, user: JSON.stringify(userObj) };
  },
  slugFor(item) {
    return slugFromEmoji(item.term);
  }
};
