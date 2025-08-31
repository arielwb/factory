Separation of Concerns: Factory vs Site vs Niche (Plugin)
1) What each layer owns
Factory (platform)

Owns: pipelines, orchestration, persistence, and abstractions.

Components: ports (DB, Storage, Queue, LLM, Renderer, Poster, Analytics), adapters (local/cloud), pipelines (ingest → select → generate → render → publish → distribute).

Knows nothing about: emojis, memes, biology, Twitter, Reddit, etc.

Input/Output:

Input = arrays of SourceItem (generic contract).

Output = Post records (generic contract) + assets (OG images).

Site (presentation)

Owns: SSR/Next.js pages, admin UI for approve/publish, SEO meta, sitemaps.

Reads from: factory’s Post table (published only).

Never: ingests, scrapes, calls social APIs, or prompts LLMs. It only reads.

Niche (plugin)

Owns: domain specifics: where to fetch from, how to parse into SourceItem, prompt text for LLM, any field mapping (e.g., how to find a “term” in a tweet title).

Implements: a tiny set of plugin interfaces (see below).

Never: talks to DB/Storage directly; it returns plain data structures to the factory.

2) Contracts (the line in the sand)

These shapes live in packages/core and are the only “language” between factory and plugins/sites.

// Generic input to the factory
type SourceItem = {
  id: string;            // stable id from upstream (hash ok)
  niche: string;         // "emoji", "acronyms", "bio"
  term: string;          // short handle ("🪿", "POV", "onions make you cry")
  lang: "en"|"pt"|string;
  text: string;          // brief context/excerpt
  sourceUrl: string;
  likes: number; shares: number; comments: number;
  firstSeenAt: Date;
  mediaUrl?: string;
};

// Factory’s internal draft shape (what the LLM must return)
type DraftExplainer = {
  title: string;
  summary: string;
  sections: {
    meaning: string;
    origin: string;
    usage: string[];     // ≤3
    variants?: string[];
    notes?: string;
  };
};

// Factory’s output persisted for sites to read
type Post = {
  id: string; niche: string; slug: string;
  title: string; summary: string; contentHtml: string;
  ogImageKey?: string; status: "draft"|"approved"|"published"; publishedAt?: Date;
};


These contracts never mention Twitter, Reddit, or emoji. Plugins map their world into these contracts; the factory processes them blindly.

3) Plugin interface (what a niche must provide)

Put this in packages/core/plugins.ts:

export interface NichePlugin {
  name: string;                       // "emoji"
  // 1) discovery: return standardized SourceItems
  discover(params: { limit: number; live: boolean }): Promise<SourceItem[]>;

  // 2) scoring hint (optional): niche-specific boosts (factory combines with global score)
  scoreHint?(item: SourceItem): number;

  // 3) LLM prompt: build inputs for the generic factory LLM call
  buildPrompt(input: { item: SourceItem }): {
    system: string;    // style/sections remain the same across niches
    user: string;      // term + context assembled by the plugin
  };

  // 4) slug + title helpers (optional)
  slugFor?(item: SourceItem): string;   // e.g., "what-does-goose-emoji-mean"
  titleFor?(draft: DraftExplainer): string;
}


Key rule: plugins return plain data and strings. The factory invokes ports (DB, LLM, Storage, etc.) and controls persistence and publishing.

4) Directory layout (enforcing borders)
packages/
  core/                 # contracts only (no business logic)
  infra/                # DI container binds ports -> adapters
  adapters/             # db/storage/queue/llm/renderer/poster/analytics
  factory/              # pipelines: ingest, select, generate, render, publish, distribute
  plugins/              # <<< all niche-specific code lives here
    emoji/
      index.ts          # implements NichePlugin
      sources/twitter.ts (pure fetch -> SourceItem[])
      prompts.ts        # buildPrompt() only
    acronyms/
    bio/
apps/
  site/                 # SSR read-only, never calls plugins or adapters
  worker/               # orchestrator: given a plugin name, runs factory pipeline


Dependency rule:

plugins/* can import core only.

factory can import core and plugins/*.

site can import core and call DB read methods only.
Enforce with ESLint + dep-cruise (or madge) to forbid illegal imports.

5) How a run actually flows (text diagram)
(worker) → factory.ingest(pluginName)
  → plugin.discover({limit, live})          // niche-specific fetch/parsing
  → factory.validate(SourceItem[])          // zod + dedupe
  → factory.score(global + plugin.scoreHint)

(worker) → factory.generate(pluginName)
  → pick queued SourceItem
  → plugin.buildPrompt(item)                // niche-specific text
  → LLM.draftExplainer(system,user)         // generic call
  → factory.persistDraft(Post)

(worker) → factory.render/post
  → Renderer.renderOgCard(Post)             // generic
  → Storage.put → Post.ogImageKey
  → DB.publish(Post)
  → Poster.plan (optional)                  // generic


At no point does the factory need to “know about emojis” — it just calls the plugin for discovery & prompt text.

6) Example: a tiny emoji plugin (shows the boundary)
// packages/plugins/emoji/index.ts
import { NichePlugin } from "@factory/core/plugins";
import { fetchEmojiFromTwitter } from "./sources/twitter";
import { normalizeEmojiTerm } from "./util";

export const emojiPlugin: NichePlugin = {
  name: "emoji",

  async discover({ limit, live }) {
    const raw = live ? await fetchEmojiFromTwitter(limit) : await import("./fixtures.json").then(m => m.default);
    // map → SourceItem (no DB writes here!)
    return raw.map(r => ({
      id: `tw:${r.id}`,
      niche: "emoji",
      term: normalizeEmojiTerm(r.term),   // e.g., "🪿"
      lang: r.lang ?? "en",
      text: r.text.slice(0, 200),
      sourceUrl: r.url,
      likes: r.likes ?? 0, shares: r.retweets ?? 0, comments: r.replies ?? 0,
      firstSeenAt: new Date(r.created_at),
      mediaUrl: r.mediaUrl
    }));
  },

  scoreHint(item) {
    // small bonus if the term is a single emoji
    return [...item.term].length === 1 ? 0.2 : 0;
  },

  buildPrompt({ item }) {
    return {
      system:
        "You write concise explainers with sections: meaning, origin, usage (2), variants, notes. Output strict JSON per schema.",
      user: JSON.stringify({
        niche: "emoji",
        term: item.term,
        snippets: [item.text],
        sources: [item.sourceUrl],
        language: item.lang
      })
    };
  },

  slugFor(item) {
    return "what-does-" + (item.term === "🪿" ? "goose-emoji" : "emoji") + "-mean";
  }
};


Note: No DB calls, no LLM calls, no storage calls here. Just data in/data out.

7) Anti-patterns (what to forbid)

❌ Plugin importing Prisma or hitting the DB.

❌ Plugin calling OpenAI directly.

❌ Site importing plugins/* or adapters/*.

❌ Factory code checking if (plugin.name === "emoji") { … }.

❌ Putting Twitter fetch logic in the factory (belongs in the plugin).

Add an ESLint rule (or dep-cruise) to block imports:

plugins/* cannot import adapters/*, factory/*, or apps/*.

apps/site/* cannot import plugins/* or adapters/*.

8) How to add a new niche (no factory edits)

Create packages/plugins/<niche>/index.ts that implements NichePlugin.

Export it in packages/plugins/index.ts.

Register once in the worker:

// apps/worker/plugins.ts
import { emojiPlugin } from "@factory/plugins/emoji";
import { acronymsPlugin } from "@factory/plugins/acronyms";
export const registry = { emoji: emojiPlugin, acronyms: acronymsPlugin };


Run with --plugin=emoji or --plugin=acronyms.
No changes to factory pipelines, sites, or adapters.

9) Enforcement & tests

Type-level: All plugin functions typed against NichePlugin.

Runtime: zod validate SourceItem array before it touches the factory.

Dep graph: run npx depcruise in CI to forbid illegal imports.

Unit tests:

plugin.discover returns valid SourceItem[] from fixtures

plugin.buildPrompt returns deterministic strings for a given item

factory pipelines accept any plugin that satisfies the interface

10) One-liner summary for Codex

“Treat factory as a domain-agnostic engine that only understands SourceItem → Draft → Post. Treat each niche as a plugin that only provides discover() and buildPrompt() (plus optional helpers). The site is read-only over Post. Plugins never touch DB/LLM/Storage; the factory never hardcodes niche logic. All integrations (Twitter, Reddit) live inside plugins and return SourceItem[].”