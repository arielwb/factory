import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { container } from '@factory/infra/container';

function parseLimit(argv: string[]): number {
  const arg = argv.find(a => a.startsWith('--limit='));
  return Math.max(1, Number(arg?.split('=')[1] || process.env.PUBLISH_LIMIT || 1));
}

(async () => {
  const limit = parseLimit(process.argv.slice(2));
  const { db } = await container();
  const drafts = await db.listDrafts();
  const picked = drafts.slice(0, limit);
  if (picked.length === 0) {
    console.log('[publish-top] no drafts');
    return;
  }
  for (const d of picked) {
    await db.publishPost(d.id);
    console.log('PUBLISHED', d.slug);
  }
})().catch((e) => {
  console.error('[publish-top] error', e?.message || e);
  process.exit(1);
});

