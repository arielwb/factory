import { config as loadEnv } from 'dotenv';
const ENV_FILE = process.env.ENV_FILE || '.env';
loadEnv({ path: ENV_FILE });
loadEnv();
import { promises as fs } from 'fs';
import { resolve } from 'path';
import { container } from '@factory/infra/container';
import { emojiPlugin } from '@factory/plugins/emoji';
import { dedupe, validateItems } from '@factory/factory/ingest/utils';
import { generateOne } from '@factory/factory/generate';
import { distributeRecent } from '@factory/factory/distribute';

type Task = { id: string; type: string; payload?: any; at: string };

async function readLines(file: string): Promise<string[]> {
  try { return (await fs.readFile(file, 'utf8')).split(/\r?\n/).filter(Boolean); } catch { return []; }
}
async function readProcessed(file: string): Promise<Record<string, boolean>> {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return {}; }
}
async function writeProcessed(file: string, obj: Record<string, boolean>) {
  await fs.mkdir(resolve(file, '..'), { recursive: true } as any).catch(() => {});
  await fs.writeFile(file, JSON.stringify(obj, null, 2), 'utf8');
}

async function processOnce() {
  const eventsFile = resolve(process.cwd(), 'data', 'events', 'tasks.jsonl');
  const stateFile = resolve(process.cwd(), 'data', 'events', 'tasks_processed.json');
  const lines = await readLines(eventsFile);
  const processed = await readProcessed(stateFile);
  const { db, llm, renderer, poster } = await container();

  for (const line of lines) {
    let task: Task | null = null;
    try { task = JSON.parse(line); } catch { continue; }
    if (!task || processed[task.id]) continue;
    const t = (task.type || '').toString();
    const p = task.payload || {};
    try {
      if (t === 'ingest') {
        const plugin = emojiPlugin; // only emoji for now
        const live = !!p.live;
        const limit = Number(p.limit || 10);
        const items = await plugin.discover({ limit, live });
        const valid = validateItems(dedupe(items));
        await db.upsertSourceItems(valid);
        console.log('[tasks] INGEST ok', valid.length);
      } else if (t === 'generate') {
        const count = Math.max(1, Number(p.count || 1));
        for (let i = 0; i < count; i++) {
          const r = await generateOne({ plugin: emojiPlugin, db, llm, renderer });
          if (!r) break;
          console.log('[tasks] GENERATE ok', r.slug);
        }
      } else if (t === 'publishTop') {
        const limit = Math.max(1, Number(p.limit || 1));
        const drafts = await db.listDrafts();
        for (const d of drafts.slice(0, limit)) { await db.publishPost(d.id); console.log('[tasks] PUBLISH ok', d.slug); }
      } else if (t === 'distributeRecent') {
        const since = Math.max(1, Number(p.since || process.env.DISTRIBUTE_SINCE_MINUTES || 1440));
        const siteOrigin = process.env.SITE_ORIGIN || 'http://localhost:3000';
        const slugs = await distributeRecent({ db, poster, siteOrigin, sinceMinutes: since, platform: 'twitter' });
        console.log('[tasks] DISTRIBUTE ok', slugs.length);
      }
      processed[task.id] = true;
    } catch (e: any) {
      console.error('[tasks] error', t, e?.message || e);
    }
  }
  await writeProcessed(stateFile, processed);
}

async function main() {
  const watch = process.argv.includes('--watch');
  if (!watch) { await processOnce(); return; }
  console.log('[tasks] watching for admin tasks...');
  while (true) {
    await processOnce();
    await new Promise(res => setTimeout(res, 3000));
  }
}

main().catch(e => { console.error('[tasks] fatal', e?.message || e); process.exit(1); });

