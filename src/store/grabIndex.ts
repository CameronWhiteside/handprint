// Per-session grab watermark, stored at .handprint/grabbed.json. Lets `grab` be
// incremental: each run only processes messages newer than the last time a
// session was grabbed, and re-grabs a session when it has grown.
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectDir } from '../dirs/project.js';

interface GrabIndexEntry {
  /** ISO timestamp of the latest message seen when this session was last grabbed. */
  lastTs: string;
  /** Session source mtime at last grab. */
  mtimeMs: number;
  grabbedAt: string;
}

export interface GrabIndex {
  version: 1;
  sessions: Record<string, GrabIndexEntry>;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function indexPath(projectRoot: string): string {
  return join(projectDir(projectRoot), 'grabbed.json');
}

export function loadGrabIndex(projectRoot: string): GrabIndex {
  const path = indexPath(projectRoot);
  if (!existsSync(path)) return { version: 1, sessions: {} };
  try {
    const raw: unknown = JSON.parse(readFileSync(path, 'utf-8'));
    if (!isRecord(raw) || !isRecord(raw.sessions)) return { version: 1, sessions: {} };
    const sessions: Record<string, GrabIndexEntry> = {};
    for (const [k, v] of Object.entries(raw.sessions)) {
      if (isRecord(v) && typeof v.lastTs === 'string') {
        sessions[k] = {
          lastTs: v.lastTs,
          mtimeMs: typeof v.mtimeMs === 'number' ? v.mtimeMs : 0,
          grabbedAt: typeof v.grabbedAt === 'string' ? v.grabbedAt : '',
        };
      }
    }
    return { version: 1, sessions };
  } catch {
    return { version: 1, sessions: {} };
  }
}

export function saveGrabIndex(projectRoot: string, index: GrabIndex): void {
  writeFileSync(indexPath(projectRoot), JSON.stringify(index, null, 2) + '\n');
}
