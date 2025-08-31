import { promises as fs } from 'fs';
import { resolve, dirname } from 'path';

export async function withCacheTTL<T>(key: string, ttlHours: number, fn: () => Promise<T>): Promise<T> {
  if (ttlHours <= 0) {
    // Bypass cache entirely
    return fn();
  }
  const file = resolve(process.cwd(), 'data/fixtures', key);
  try {
    const stat = await fs.stat(file);
    const ageMs = Date.now() - stat.mtimeMs;
    if (ageMs < ttlHours * 3600_000) {
      const raw = await fs.readFile(file, 'utf8');
      return JSON.parse(raw) as T;
    }
  } catch {}
  const fresh = await fn();
  await fs.mkdir(dirname(file), { recursive: true });
  await fs.writeFile(file, JSON.stringify(fresh, null, 2), 'utf8');
  return fresh;
}

export async function writeHealth(key: string, payload: any) {
  try {
    const file = resolve(process.cwd(), 'data/fixtures', 'reservoir-health.json');
    let data: Record<string, any> = {};
    try {
      data = JSON.parse(await fs.readFile(file, 'utf8'));
    } catch {}
    data[key] = { ...payload, at: new Date().toISOString() };
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf8');
  } catch {}
}
