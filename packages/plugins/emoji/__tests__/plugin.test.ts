import { describe, it, expect } from 'vitest';
import { emojiPlugin } from '@factory/plugins/emoji';
import { SourceItem } from '@factory/core/ports';

describe('emoji plugin', () => {
  it('discover(mock) maps fixtures to valid SourceItem[]', async () => {
    const items = await emojiPlugin.discover({ limit: 3, live: false });
    expect(Array.isArray(items)).toBe(true);
    expect(items.length).toBeGreaterThan(0);
    const first = SourceItem.safeParse(items[0]);
    expect(first.success).toBe(true);
  });

  it('buildPrompt is deterministic for a given item', () => {
    const item = {
      id: 'tw:123', niche: 'emoji', term: '🪿', lang: 'en',
      text: 'goose emoji trending', sourceUrl: 'https://twitter.com/i/web/status/123',
      likes: 1, shares: 1, comments: 1, firstSeenAt: new Date()
    };
    const a = emojiPlugin.buildPrompt({ item });
    const b = emojiPlugin.buildPrompt({ item });
    expect(a.system).toBeTypeOf('string');
    expect(b.user).toEqual(a.user);
    const parsed = JSON.parse(a.user);
    expect(parsed.term).toBe(item.term);
    expect(parsed.snippets[0]).toContain('goose');
    expect(parsed.sources[0]).toContain('twitter.com');
  });
});

