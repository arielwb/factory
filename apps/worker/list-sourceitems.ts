import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env.local';
loadEnv({ path: ENV_FILE });
loadEnv();
import { PrismaClient } from '@prisma/client';

function parseLimit(argv: string[]): number {
  const arg = argv.find((a) => a.startsWith('--limit='));
  return Math.max(1, Number(arg?.split('=')[1] || 50));
}

(async () => {
  const limit = parseLimit(process.argv.slice(2));
  const prisma = new PrismaClient();
  const rows = await prisma.sourceItem.findMany({ select: { term: true }, take: 5000 });
  const counts = new Map<string, number>();
  for (const r of rows) counts.set(r.term, (counts.get(r.term) ?? 0) + 1);
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
  console.log('[db:terms] unique terms:', counts.size, 'top', limit);
  console.table(top.map(([term, count]) => ({ term, count })));
})().catch((e) => {
  console.error('[db:terms] error', e?.message || e);
  process.exit(1);
});

