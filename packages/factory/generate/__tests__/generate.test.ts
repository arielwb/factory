import { describe, it, expect } from 'vitest';
import { generateOne } from '@factory/factory/generate';
import type { DB, LLM, Renderer, TSourceItem } from '@factory/core/ports';
import { emojiPlugin } from '@factory/plugins/emoji';

function makeItem(): TSourceItem {
  return {
    id: 'mock:1', niche: 'emoji', term: '🪿', lang: 'en', text: 'goose emoji', sourceUrl: 'https://x/1', likes: 1, shares: 0, comments: 0, firstSeenAt: new Date()
  } as any;
}

describe('factory.generate.generateOne', () => {
  it('creates a draft post with rendered OG using stubs', async () => {
    const queued: TSourceItem[] = [makeItem()];
    const created: any[] = [];

    const db: DB = {
      async upsertSourceItems() {},
      async queueTopNForDraft() { return queued; },
      async createDraftPost(p) { created.push(p); return { id: 'p1', slug: p.slug }; },
      async listDrafts() { return []; },
      async publishPost() {},
      async getPostBySlug(slug) { return created.find(x => x.slug === slug) || null; }
    };
    const llm: LLM = {
      async draftExplainer() {
        return {
          title: 'What does 🪿 mean?',
          summary: 'A goose emoji explainer.',
          sections: { meaning: 'goose', origin: 'internet', usage: ['chat', 'caption'] }
        } as any;
      }
    };
    const renderer: Renderer = {
      async renderOgCard({ slug }) { return { key: `og/${slug}.png` }; }
    };

    const result = await generateOne({ plugin: emojiPlugin, db, llm, renderer });
    expect(result).not.toBeNull();
    expect(created.length).toBe(1);
    expect(created[0].ogImageKey).toContain('og/');
  });
});

