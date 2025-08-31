import { describe, it, expect } from 'vitest';
import { withCache, validateItems, dedupe } from '@factory/factory/ingest/utils';

describe('factory.ingest.utils', () => {
  it('withCache writes and reuses cached data', async () => {
    let calls = 0;
    const fn = async () => { calls++; return { ok: true, t: Date.now() }; };
    const first = await withCache('test-cache.json', fn, true); // force refresh
    const second = await withCache('test-cache.json', fn, false); // reuse
    expect(calls).toBe(1);
    expect(second).toEqual(first);
  });

  it('validateItems accepts valid SourceItem[] and throws on invalid', () => {
    const valid = [{
      id: 'x', niche: 'emoji', term: '🪿', lang: 'en', text: 't', sourceUrl: 'https://ex', likes: 0, shares: 0, comments: 0, firstSeenAt: new Date()
    }];
    expect(() => validateItems(valid as any)).not.toThrow();
    const invalid = [{ ...valid[0], id: undefined }];
    expect(() => validateItems(invalid as any)).toThrow();
  });

  it('dedupe removes duplicate ids', () => {
    const a: any = { id: '1' }; const b: any = { id: '1' }; const c: any = { id: '2' };
    const out = dedupe([a, b, c] as any);
    expect(out.length).toBe(2);
  });
});

