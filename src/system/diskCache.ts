import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import superjson from 'superjson';

function ensureDir(filePath: string) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

export function loadCache<T>(filePath: string): T | undefined {
  try {
    if (!existsSync(filePath)) return undefined;
    const raw = readFileSync(filePath, 'utf8');
    if (!raw) return undefined;
    return superjson.parse(raw);
  } catch (err) {
    console.warn('loadCache: failed to load cache file', filePath, err);
    return undefined;
  }
}

export function saveCache<T>(filePath: string, value: T): void {
  try {
    ensureDir(filePath);
    writeFileSync(filePath, superjson.stringify(value), 'utf8');
  } catch (err) {
    console.warn('saveCache: failed to save cache file', filePath, err);
  }
}
