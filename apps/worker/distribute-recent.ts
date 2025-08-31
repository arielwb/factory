import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { container } from '@factory/infra/container';
import { distributeRecent } from '@factory/factory/distribute';

function parseSince(argv: string[]): number {
  const arg = argv.find(a => a.startsWith('--since='));
  return Math.max(1, Number(arg?.split('=')[1] || process.env.DISTRIBUTE_SINCE_MINUTES || 1440));
}

(async () => {
  const since = parseSince(process.argv.slice(2));
  const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:3000';
  const { db, poster } = await container();
  const slugs = await distributeRecent({ db, poster, siteOrigin, sinceMinutes: since, platform: 'twitter' });
  console.log('[distribute-recent] planned', slugs.length, 'posts');
  slugs.forEach(s => console.log('PLANNED', s));
})().catch((e) => {
  console.error('[distribute-recent] error', e?.message || e);
  process.exit(1);
});

