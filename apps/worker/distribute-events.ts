import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { container } from '@factory/infra/container';
import { promises as fs } from 'fs';
import { resolve } from 'path';

type PublishEvent = { id: string; slug: string; at: string | number | Date };

async function readLines(file: string): Promise<string[]> {
  try {
    const raw = await fs.readFile(file, 'utf8');
    return raw.split(/\r?\n/).filter(Boolean);
  } catch {
    return [];
  }
}

async function readProcessed(file: string): Promise<Record<string, boolean>> {
  try {
    return JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, boolean>;
  } catch {
    return {};
  }
}

async function writeProcessed(file: string, obj: Record<string, boolean>) {
  await fs.mkdir(resolve(file, '..'), { recursive: true } as any).catch(() => {});
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}

async function processOnce() {
  const eventsFile = resolve(process.cwd(), 'data', 'events', 'published.jsonl');
  const stateFile = resolve(process.cwd(), 'data', 'events', 'distributed.json');
  const lines = await readLines(eventsFile);
  const processed = await readProcessed(stateFile);

  const { db, poster } = await container();
  const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:3000';

  for (const line of lines) {
    let ev: PublishEvent | null = null;
    try { ev = JSON.parse(line); } catch { continue; }
    if (!ev || processed[ev.id]) continue;
    const post = await db.getPostBySlug(ev.slug);
    if (!post) { processed[ev.id] = true; continue; }
    const url = `${String(siteOrigin).replace(/\/$/, '')}/${post.slug}`;
    const text = `${post.title} ${url}`;
    await poster.planPost({ platform: 'twitter', text, url, mediaKey: post.ogImageKey || undefined });
    processed[ev.id] = true;
    console.log('PLANNED_FROM_EVENT', post.slug);
  }
  await writeProcessed(stateFile, processed);
}

async function main() {
  const watch = process.argv.includes('--watch');
  if (!watch) {
    await processOnce();
    return;
  }
  console.log('[distribute-events] watching for publish events...');
  while (true) {
    await processOnce();
    await new Promise(res => setTimeout(res, 5000));
  }
}

main().catch(e => { console.error('[distribute-events] error', e?.message || e); process.exit(1); });

