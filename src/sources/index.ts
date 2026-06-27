// src/sources/index.ts
import type { SourceAdapter, SessionRef, LocateOpts } from './types.js';
import { claudeCodeAdapter } from './claude-code.js';
import { opencodeAdapter } from './opencode.js';
import { codexAdapter } from './codex.js';
import { cursorAdapter } from './cursor.js';

export * from './types.js';

export const ALL_ADAPTERS: SourceAdapter[] = [
  claudeCodeAdapter,
  opencodeAdapter,
  codexAdapter,
  cursorAdapter,
];

export function adapterById(id: string): SourceAdapter | undefined {
  return ALL_ADAPTERS.find((a) => a.descriptor.id === id);
}

export function enabledAdapters(enabled?: string[]): SourceAdapter[] {
  return ALL_ADAPTERS.filter((a) => {
    if (!a.descriptor.implemented) return false;
    if (enabled && !enabled.includes(a.descriptor.id)) return false;
    return true;
  });
}

export function discoverSessions(opts?: {
  homeDir?: string;
  sources?: string[];
  sourceId?: string;
}): SessionRef[] {
  const allow = opts?.sourceId ? [opts.sourceId] : opts?.sources;
  const adapters = enabledAdapters(allow);
  const locateOpts: LocateOpts = { homeDir: opts?.homeDir };
  const refs = adapters.flatMap((a) => {
    try {
      return a.locate(locateOpts);
    } catch {
      return [];
    }
  });
  return refs.sort((a, b) => b.mtimeMs - a.mtimeMs);
}
