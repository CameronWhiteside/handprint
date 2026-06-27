import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export interface JsonlFile { path: string; mtimeMs: number; dir: string; name: string; }

// Enumerate *.jsonl one level under each child dir of `baseDir` (the claude layout).
export function listJsonlFiles(baseDir: string): JsonlFile[] {
  if (!existsSync(baseDir)) return [];
  const out: JsonlFile[] = [];
  for (const child of readdirSync(baseDir)) {
    const childDir = join(baseDir, child);
    let files: string[];
    try { files = readdirSync(childDir).filter((f) => f.endsWith('.jsonl')); } catch { continue; }
    for (const name of files) {
      const path = join(childDir, name);
      let mtimeMs = 0;
      try { mtimeMs = statSync(path).mtimeMs; } catch { /* ignore */ }
      out.push({ path, mtimeMs, dir: child, name });
    }
  }
  return out;
}

export function readJsonlLines(path: string): string[] {
  return readFileSync(path, 'utf-8').split('\n');
}
