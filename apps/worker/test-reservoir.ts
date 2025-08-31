import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { buildReservoir } from '@factory/plugins/emoji/lib/reservoir';
import { topEmojisFromReservoir } from '@factory/plugins/emoji/lib/discover';

function parseLimit(argv: string[], key: string, fallback: number): number {
  const arg = argv.find((a) => a.startsWith(`--${key}=`));
  return Math.max(1, Number(arg?.split('=')[1] || fallback));
}

(async () => {
  const rowsLimit = parseLimit(process.argv.slice(2), 'rows', Number(process.env.RESERVOIR_LIMIT || 300));
  const topLimit = parseLimit(process.argv.slice(2), 'top', 20);
  const rows = await buildReservoir(rowsLimit);
  const top = await topEmojisFromReservoir(rows);
  console.log(`[reservoir] providers=${process.env.DISCOVER_PROVIDERS || ''} rows=${rows.length}`);
  console.table(top.slice(0, topLimit).map((t) => ({ emoji: t.emoji, freq: t.freq, score: Number(t.score.toFixed(2)) })));
})().catch((e) => {
  console.error('[reservoir] error', e?.message || e);
  process.exit(1);
});
