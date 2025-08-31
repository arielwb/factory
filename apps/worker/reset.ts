import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { PrismaClient } from '@prisma/client';
import { promises as fs } from 'fs';
import { resolve } from 'path';

const prisma = new PrismaClient();

async function rmIfExists(p: string) {
  try { await fs.rm(p, { force: true }); } catch {}
}
async function rmDirContents(dir: string) {
  try {
    const ents = await fs.readdir(dir);
    await Promise.all(ents.map(e => fs.rm(resolve(dir, e), { recursive: true, force: true })));
  } catch {}
}

function hasFlag(name: string) {
  return process.argv.includes(`--${name}`);
}

async function clearCaches() {
  const fixtures = resolve(process.cwd(), 'data', 'fixtures');
  try {
    const files = await fs.readdir(fixtures);
    await Promise.all(files
      .filter(f => f.startsWith('reservoir-') || f === 'emoji-lru.json' || f === 'emoji-live.json' || f === 'trends_state.json' || f === 'reservoir-health.json' || f.startsWith('trends'))
      .map(f => fs.rm(resolve(fixtures, f), { force: true, recursive: true }))
    );
  } catch {}
}

async function clearEvents() {
  const eventsDir = resolve(process.cwd(), 'data', 'events');
  await rmIfExists(resolve(eventsDir, 'published.jsonl'));
  await rmIfExists(resolve(eventsDir, 'distributed.json'));
  await rmIfExists(resolve(eventsDir, 'tasks.jsonl'));
  await rmIfExists(resolve(eventsDir, 'tasks_processed.json'));
}

async function clearOutboxAndMedia() {
  await rmIfExists(resolve(process.cwd(), 'data', 'outbox', 'social.json'));
  await rmDirContents(resolve(process.cwd(), 'data', 'media', 'og'));
}

async function main() {
  const clearAll = hasFlag('all');
  const draftsOnly = hasFlag('drafts');
  const discovery = hasFlag('discovery');

  if (clearAll) {
    console.log('[reset] deleting ALL posts and SourceItems...');
    await prisma.post.deleteMany({});
    await prisma.sourceItem.deleteMany({});
  } else if (discovery) {
    console.log('[reset] deleting drafts and all SourceItems...');
    await prisma.post.deleteMany({ where: { status: 'draft' } });
    await prisma.sourceItem.deleteMany({});
  } else if (draftsOnly) {
    console.log('[reset] deleting drafts only...');
    await prisma.post.deleteMany({ where: { status: 'draft' } });
  }

  console.log('[reset] clearing caches, events, outbox, and media...');
  await clearCaches();
  await clearEvents();
  await clearOutboxAndMedia();
  console.log('[reset] done');
}

main().catch(e => { console.error('[reset] error', e?.message || e); process.exit(1); });

