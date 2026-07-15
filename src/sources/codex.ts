// src/sources/codex.ts
//
// Reads Codex CLI rollout transcripts: one JSONL file per session under
// ~/.codex/sessions/<YYYY>/<MM>/<DD>/rollout-*.jsonl. Each line is
// { timestamp, type, payload }. Conversation turns are taken from `event_msg`
// lines (`user_message` / `agent_message`) — `response_item` message lines
// mirror the same text but also carry developer/environment noise. File paths
// touched by `apply_patch` tool calls are captured for repo attribution,
// resolved against the session cwd (`session_meta`, updated by `turn_context`).
import { openSync, readSync, closeSync, existsSync, readdirSync, statSync, readFileSync } from 'node:fs';
import { join, resolve, isAbsolute, basename } from 'node:path';
import { homedir } from 'node:os';
import type {
  SourceAdapter,
  SessionRef,
  NormalizedSession,
  TranscriptEntry,
  LocateOpts,
} from './types.js';

interface CodexLine {
  timestamp?: string;
  type?: string;
  payload?: Record<string, unknown>;
}

function isRecord(val: unknown): val is Record<string, unknown> {
  return typeof val === 'object' && val !== null;
}

function isCodexLine(val: unknown): val is CodexLine {
  if (!isRecord(val)) return false;
  const { timestamp, type, payload } = val;
  if (timestamp !== undefined && typeof timestamp !== 'string') return false;
  if (type !== undefined && typeof type !== 'string') return false;
  if (payload !== undefined && !isRecord(payload)) return false;
  return true;
}

function parseCodexLine(line: string): CodexLine | null {
  if (!line.trim()) return null;
  try {
    const raw: unknown = JSON.parse(line);
    return isCodexLine(raw) ? raw : null;
  } catch {
    return null;
  }
}

function sessionsDir(home: string): string {
  return join(home, '.codex', 'sessions');
}

// Session files nest by date (YYYY/MM/DD); walk the whole tree for *.jsonl.
function walkJsonlFiles(dir: string): string[] {
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
    if (isDir) out.push(...walkJsonlFiles(full));
    else if (name.endsWith('.jsonl')) out.push(full);
  }
  return out;
}

// The first line (session_meta) carries the session id and cwd, but also the
// full base instructions (tens of KB), so read a bounded prefix rather than
// the whole file — locate() runs over every session on every scan.
const FIRST_LINE_MAX_BYTES = 256 * 1024;

function readFirstLine(path: string): string {
  let fd: number;
  try {
    fd = openSync(path, 'r');
  } catch {
    return '';
  }
  try {
    const buf = Buffer.alloc(FIRST_LINE_MAX_BYTES);
    const n = readSync(fd, buf, 0, FIRST_LINE_MAX_BYTES, 0);
    const text = buf.toString('utf-8', 0, n);
    const nl = text.indexOf('\n');
    return nl === -1 ? text : text.slice(0, nl);
  } catch {
    return '';
  } finally {
    closeSync(fd);
  }
}

interface SessionMeta {
  id: string;
  cwd: string;
  threadSource: string;
}

function readSessionMeta(path: string): SessionMeta | null {
  const parsed = parseCodexLine(readFirstLine(path));
  if (!parsed || parsed.type !== 'session_meta' || !isRecord(parsed.payload)) return null;
  const { id, cwd, thread_source } = parsed.payload;
  if (typeof id !== 'string' || !id) return null;
  return {
    id,
    cwd: typeof cwd === 'string' ? cwd : '',
    threadSource: typeof thread_source === 'string' ? thread_source : 'user',
  };
}

// apply_patch envelope headers, e.g. "*** Update File: src/x.ts".
const PATCH_FILE_RE = /^\*\*\* (?:Add|Update|Delete) File: (.+)$/gm;

/** File paths named in an apply_patch input, resolved against `cwd` (for repo
 *  attribution — infer-artifact only uses absolute paths). */
export function extractPatchPaths(input: string, cwd: string): string[] {
  const paths: string[] = [];
  for (const m of input.matchAll(PATCH_FILE_RE)) {
    const p = m[1].trim();
    if (!p) continue;
    if (isAbsolute(p)) paths.push(p);
    else if (cwd) paths.push(resolve(cwd, p));
  }
  return paths;
}

/** The apply_patch envelope of a response_item, if this line is one. Codex
 *  emits apply_patch as a custom_tool_call (`input` string); tolerate the
 *  function_call form (`arguments` JSON with an `input` field) as well. */
function applyPatchInput(payload: Record<string, unknown>): string | null {
  if (payload['name'] !== 'apply_patch') return null;
  if (payload['type'] === 'custom_tool_call' && typeof payload['input'] === 'string') {
    return payload['input'];
  }
  if (payload['type'] === 'function_call' && typeof payload['arguments'] === 'string') {
    try {
      const args: unknown = JSON.parse(payload['arguments']);
      if (isRecord(args) && typeof args['input'] === 'string') return args['input'];
    } catch {
      return null;
    }
  }
  return null;
}

/** The transcript entry a parsed line contributes, or null if it isn't one
 *  (conversation turns come from event_msg; apply_patch tool calls become
 *  path-only entries for repo attribution). Pure per line — the caller owns
 *  the cwd state, since session_meta/turn_context set it for later lines. */
export function entryFromLine(
  parsed: CodexLine,
  cwd: string,
  ref: SessionRef,
): TranscriptEntry | null {
  if (!isRecord(parsed.payload)) return null;
  const payload = parsed.payload;
  const timestamp = parsed.timestamp ?? '';

  if (parsed.type === 'event_msg') {
    const kind = payload['type'];
    if (kind !== 'user_message' && kind !== 'agent_message') return null;
    const text = payload['message'];
    if (typeof text !== 'string' || !text.trim()) return null;
    return {
      role: kind === 'user_message' ? 'user' : 'assistant',
      text,
      timestamp,
      cwd,
      sessionId: ref.sessionId,
      gitBranch: '',
    };
  }

  if (parsed.type === 'response_item') {
    const input = applyPatchInput(payload);
    if (input === null) return null;
    const paths = extractPatchPaths(input, cwd);
    if (paths.length === 0) return null;
    // A pure tool-call entry: no text, but it tells us which repo changed.
    return {
      role: 'assistant',
      text: '',
      timestamp,
      cwd,
      sessionId: ref.sessionId,
      gitBranch: '',
      paths,
    };
  }

  return null;
}

export const codexAdapter: SourceAdapter = {
  descriptor: {
    id: 'codex',
    displayName: 'Codex CLI',
    sourceAgent: 'codex',
    capabilities: { timestamps: 'iso', session: true, project: true, gitBranch: false, model: true },
    locations: ['~/.codex/sessions/**/*.jsonl'],
    implemented: true,
  },

  locate(opts?: LocateOpts): SessionRef[] {
    const home = opts?.homeDir ?? homedir();
    const refs: SessionRef[] = [];
    for (const path of walkJsonlFiles(sessionsDir(home))) {
      let mtimeMs = 0;
      try {
        mtimeMs = statSync(path).mtimeMs;
      } catch {
        /* ignore */
      }
      const meta = readSessionMeta(path);
      // Subagent threads (thread_source !== 'user') are spawned by the agent:
      // their "user" turns are agent prompts, not human decisions. The human's
      // decisions live in the parent thread, which is its own session file.
      if (meta && meta.threadSource !== 'user') continue;
      refs.push({
        sourceId: 'codex',
        sessionId: meta?.id ?? basename(path).replace('.jsonl', ''),
        project: (meta?.cwd ?? '').replace(/^\/Users\//, '~/') || '(unknown)',
        locator: path,
        mtimeMs,
      });
    }
    return refs;
  },

  parse(ref: SessionRef): NormalizedSession {
    const entries: TranscriptEntry[] = [];
    let lines: string[];
    try {
      lines = readFileSync(ref.locator, 'utf-8').split('\n');
    } catch {
      return { ref, entries };
    }

    let cwd = '';
    for (const line of lines) {
      const parsed = parseCodexLine(line);
      if (!parsed || !isRecord(parsed.payload)) continue;
      // session_meta opens the file; turn_context updates cwd per turn.
      if (parsed.type === 'session_meta' || parsed.type === 'turn_context') {
        if (typeof parsed.payload['cwd'] === 'string') cwd = parsed.payload['cwd'];
        continue;
      }
      const entry = entryFromLine(parsed, cwd, ref);
      if (entry) entries.push(entry);
    }
    return { ref, entries };
  },
};
