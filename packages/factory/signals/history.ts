import { promises as fs } from 'fs';
import { resolve } from 'path';

const FILE = resolve(process.cwd(), 'data/fixtures/history.json');

export async function readHistory(): Promise<Record<string, number[]>> {
  try { return JSON.parse(await fs.readFile(FILE, 'utf8')); } catch { return {}; }
}

export async function updateHistory(term: string, value: number) {
  const h = await readHistory();
  const arr = h[term] ?? [];
  h[term] = [...arr.slice(-6), value];
  await fs.mkdir(resolve(FILE, '..'), { recursive: true } as any).catch(()=>{});
  await fs.writeFile(FILE, JSON.stringify(h, null, 2), 'utf8');
}
