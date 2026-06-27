// src/sources/opencode.ts
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {
  SourceAdapter,
  SessionRef,
  NormalizedSession,
  TranscriptEntry,
  LocateOpts,
} from './types.js';

interface OcSession {
  id: string;
  directory?: string;
  time?: { created?: number; updated?: number };
}
interface OcMessage {
  id: string;
  role: string;
  time?: { created?: number };
  path?: { cwd?: string };
}
interface OcPart {
  type: string;
  text?: string;
}
interface OcTextPart extends OcPart {
  text: string;
}

function storageDir(home: string): string {
  return join(home, '.local', 'share', 'opencode', 'storage');
}

// Narrows unknown to a plain object with string-indexed unknown values.
// The type predicate is trusted by TypeScript without an 'as' cast in the body.
function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function isOcSession(val: unknown): val is OcSession {
  return isRecord(val) && typeof val['id'] === 'string';
}

function isOcMessage(val: unknown): val is OcMessage {
  if (!isRecord(val)) return false;
  const role = val['role'];
  return typeof val['id'] === 'string' && (role === 'user' || role === 'assistant');
}

function isOcTextPart(val: unknown): val is OcTextPart {
  if (!isRecord(val)) return false;
  return val['type'] === 'text' && typeof val['text'] === 'string';
}

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function toIso(ms: number | undefined): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '';
  return new Date(ms).toISOString();
}

// session files may be nested; walk the session/ tree for *.json
function walkSessionFiles(dir: string): string[] {
  const out: string[] = [];
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let isDir = false;
    try {
      isDir = statSync(full).isDirectory();
    } catch {
      continue;
    }
    if (isDir) out.push(...walkSessionFiles(full));
    else if (name.endsWith('.json')) out.push(full);
  }
  return out;
}

export const opencodeAdapter: SourceAdapter = {
  descriptor: {
    id: 'opencode',
    displayName: 'opencode',
    sourceAgent: 'opencode',
    capabilities: { timestamps: 'epoch-ms', session: true, project: true, gitBranch: false, model: true },
    locations: ['~/.local/share/opencode/storage'],
    implemented: true,
  },

  locate(opts?: LocateOpts): SessionRef[] {
    const home = opts?.homeDir ?? homedir();
    const base = storageDir(home);
    const sessionDir = join(base, 'session');
    if (!existsSync(sessionDir)) return [];
    const refs: SessionRef[] = [];
    for (const file of walkSessionFiles(sessionDir)) {
      const raw = readJson(file);
      if (!isOcSession(raw)) continue;
      const s = raw;
      const msgDir = join(base, 'message', s.id);
      if (!existsSync(msgDir)) continue;
      let mtimeMs = s.time?.updated ?? s.time?.created ?? 0;
      try {
        mtimeMs = statSync(msgDir).mtimeMs;
      } catch {
        /* keep session time */
      }
      refs.push({
        sourceId: 'opencode',
        sessionId: s.id,
        project: (s.directory ?? '').replace(/^\/Users\//, '~/') || '(unknown)',
        locator: base, // adapter re-derives paths from base + sessionId
        mtimeMs,
      });
    }
    return refs;
  },

  parse(ref: SessionRef): NormalizedSession {
    const base = ref.locator;
    const msgDir = join(base, 'message', ref.sessionId);
    const entries: TranscriptEntry[] = [];
    if (!existsSync(msgDir)) return { ref, entries };

    const messages = readdirSync(msgDir)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJson(join(msgDir, f)))
      .filter(isOcMessage)
      .sort((a, b) => (a.time?.created ?? 0) - (b.time?.created ?? 0));

    for (const m of messages) {
      const partDir = join(base, 'part', m.id);
      if (!existsSync(partDir)) continue;
      const text = readdirSync(partDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => readJson(join(partDir, f)))
        .filter(isOcTextPart)
        .map((p) => p.text)
        .join('');
      if (!text.trim()) continue;
      entries.push({
        role: m.role === 'user' ? 'user' : 'assistant',
        text,
        timestamp: toIso(m.time?.created),
        cwd: m.path?.cwd ?? ref.project,
        sessionId: ref.sessionId,
        gitBranch: '',
      });
    }
    return { ref, entries };
  },
};
