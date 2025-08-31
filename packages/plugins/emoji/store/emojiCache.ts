import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';

const FILE = resolve(process.cwd(), 'data/fixtures/emoji-lru.json');
let mem: Record<string, number> | null = null;

async function load(): Promise<Record<string, number>> {
  if (mem) return mem;
  try {
    const raw = await fs.readFile(FILE, 'utf8');
    mem = JSON.parse(raw);
  } catch {
    mem = {};
  }
  return mem!;
}

async function save() {
  if (!mem) return;
  await fs.mkdir(dirname(FILE), { recursive: true });
  await fs.writeFile(FILE, JSON.stringify(mem, null, 2));
}

export async function getEmojiLRU(emoji: string): Promise<number | null> {
  const map = await load();
  return map[emoji] ?? null;
}

export async function setEmojiLRU(emoji: string, when: number): Promise<void> {
  const map = await load();
  map[emoji] = when;
  await save();
}

