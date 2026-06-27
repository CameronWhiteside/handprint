import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readObject } from '../store/objects.js';
import { projectDir } from '../dirs/project.js';
import type { HandprintObject } from '@handprint/types';

export interface HandprintEntry {
  hash: string;
  handprint: HandprintObject;
}

export interface ListOptions {
  type?: string;
  limit?: number;
}

export function listHandprints(
  projectRoot: string,
  options?: ListOptions,
): HandprintEntry[] {
  const hpDir = projectDir(projectRoot);
  const logPath = join(hpDir, 'log');

  if (!existsSync(logPath)) return [];

  const hashes = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
  const entries: HandprintEntry[] = [];

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!obj) continue;
    const hp = obj as unknown as HandprintObject;

    if (options?.type) {
      const hasType = hp.marks.some((m) => m.type === options.type);
      if (!hasType) continue;
    }

    entries.push({ hash, handprint: hp });
  }

  if (options?.limit) {
    return entries.slice(-options.limit);
  }

  return entries;
}
