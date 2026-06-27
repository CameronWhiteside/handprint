# Adding a Source Adapter

handprint discovers AI conversation transcripts through **source adapters**. Each adapter implements a small interface and tells the runtime where sessions live on disk and how to parse them into a normalised form.

---

## The `SourceAdapter` interface

Every adapter must satisfy this interface (from `src/sources/types.ts`):

```typescript
export interface SourceAdapter {
  descriptor: SourceDescriptor;
  locate(opts?: LocateOpts): SessionRef[];
  parse(ref: SessionRef): NormalizedSession;
}
```

### `SourceDescriptor`

```typescript
export interface SourceDescriptor {
  id: string;           // stable machine key, e.g. "claude-code"
  displayName: string;  // human label shown in CLI output
  sourceAgent: string;  // value written to handprint.source.agent in every record
  capabilities: SourceCapabilities;
  locations: string[];  // glob-like hints shown in docs / diagnostics
  implemented: boolean; // false → locate() returns [] and parse() throws NotImplementedError
}
```

### `SourceCapabilities`

```typescript
export interface SourceCapabilities {
  timestamps: 'iso' | 'epoch-ms' | 'none'; // what the raw data provides
  session: boolean;    // adapter can isolate per-session boundaries
  project: boolean;    // adapter can infer the working project / directory
  gitBranch: boolean;  // adapter can read the git branch from the transcript
  model: boolean;      // adapter can identify which model answered
}
```

Field semantics:

| Field | Meaning |
|---|---|
| `timestamps` | Clock resolution available. `iso` = full ISO 8601; `epoch-ms` = milliseconds since epoch; `none` = absent. |
| `session` | Whether conversations are already split into discrete sessions on disk. If `false`, the adapter produces a single synthetic session. |
| `project` | Whether the adapter can derive a project path (working directory). If `false`, `SessionRef.project` will be empty. |
| `gitBranch` | Whether the adapter captures the git branch in the raw data. If `false`, `TranscriptEntry.gitBranch` is always `''`. |
| `model` | Whether the adapter can identify the model name. Currently informational; extraction uses a separate local model regardless. |

---

## Key types

```typescript
export interface SessionRef {
  sourceId: string;  // must match descriptor.id
  sessionId: string; // unique within the source
  project: string;   // human-readable project path, e.g. "~/src/myapp"
  locator: string;   // absolute path (or base dir) the adapter needs to re-find the data
  mtimeMs: number;   // last-modified timestamp — used to sort sessions newest-first
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO 8601 (empty string if unavailable)
  cwd: string;
  sessionId: string;
  gitBranch: string;
}

export interface NormalizedSession {
  ref: SessionRef;
  entries: TranscriptEntry[];
}
```

---

## How `discoverSessions` uses the adapter

`discoverSessions` (in `src/sources/index.ts`) does the following:

1. Calls `enabledAdapters(sources?)` to filter to adapters that are `implemented: true` and (if a `--source` list was provided) match the requested ids.
2. Calls `adapter.locate(opts)` on each adapter, collecting `SessionRef[]`. The `opts` may carry a `homeDir` override (used in tests to point at a fixture directory). The refs are sorted by `mtimeMs` descending so the most-recently-touched session is first.
3. Later, `grab` calls `adapter.parse(ref)` for each session it wants to process, turning the raw on-disk data into `NormalizedSession`.

`mtimeMs` in `SessionRef` is the only signal used for ordering. Populate it from `statSync(path).mtimeMs`; if the stat fails, use `0`.

---

## `descriptor.sourceAgent` and `handprint.source.agent`

The string you put in `descriptor.sourceAgent` is recorded verbatim in every handprint record's `source.agent` field. Pick a stable, lowercase, hyphenated identifier that matches the tool brand (e.g. `"claude-code"`, `"opencode"`). Changing it after shipping breaks identity continuity for users who have existing records.

---

## Worked example — a JSONL-glob adapter

Suppose you want to read sessions from a tool that writes one JSONL file per session under `~/.mytool/sessions/<project>/<session-id>.jsonl`, where each line is:

```json
{"role":"user","text":"...","ts":1700000000000}
{"role":"assistant","text":"...","ts":1700000001000}
```

Here is a minimal complete adapter:

```typescript
// src/sources/mytool.ts
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SourceAdapter, SessionRef, NormalizedSession, TranscriptEntry, LocateOpts } from './types.js';

function sessionsDir(home: string): string {
  return join(home, '.mytool', 'sessions');
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

export const mytoolAdapter: SourceAdapter = {
  descriptor: {
    id: 'mytool',
    displayName: 'MyTool',
    sourceAgent: 'mytool',       // ← written to handprint.source.agent
    capabilities: {
      timestamps: 'epoch-ms',
      session: true,
      project: true,
      gitBranch: false,
      model: false,
    },
    locations: ['~/.mytool/sessions/*/*.jsonl'],
    implemented: true,
  },

  locate(opts?: LocateOpts): SessionRef[] {
    const home = opts?.homeDir ?? homedir();
    const base = sessionsDir(home);
    if (!existsSync(base)) return [];

    const refs: SessionRef[] = [];
    for (const project of readdirSync(base)) {
      const projectDir = join(base, project);
      let files: string[];
      try {
        files = readdirSync(projectDir).filter(f => f.endsWith('.jsonl'));
      } catch { continue; }

      for (const file of files) {
        const path = join(projectDir, file);
        let mtimeMs = 0;
        try { mtimeMs = statSync(path).mtimeMs; } catch { /* ignore */ }
        refs.push({
          sourceId: 'mytool',
          sessionId: file.replace('.jsonl', ''),
          project: project.replace(/-/g, '/').replace(/^\/Users\//, '~/'),
          locator: path,
          mtimeMs,
        });
      }
    }
    return refs;
  },

  parse(ref: SessionRef): NormalizedSession {
    const lines = readFileSync(ref.locator, 'utf-8').split('\n');
    const entries: TranscriptEntry[] = [];
    for (const line of lines) {
      if (!line.trim()) continue;
      let raw: unknown;
      try { raw = JSON.parse(line); } catch { continue; }
      if (!isRecord(raw)) continue;
      const { role, text, ts } = raw;
      if ((role !== 'user' && role !== 'assistant') || typeof text !== 'string' || !text) continue;
      entries.push({
        role,
        text,
        timestamp: typeof ts === 'number' ? new Date(ts).toISOString() : '',
        cwd: '',
        sessionId: ref.sessionId,
        gitBranch: '',
      });
    }
    return { ref, entries };
  },
};
```

Then register it in `src/sources/index.ts`:

```typescript
import { mytoolAdapter } from './mytool.js';

export const ALL_ADAPTERS: SourceAdapter[] = [
  claudeCodeAdapter,
  opencodeAdapter,
  codexAdapter,
  cursorAdapter,
  mytoolAdapter,   // ← add here
];
```

---

## Checklist

- [ ] `descriptor.id` is lowercase, hyphenated, unique across all adapters.
- [ ] `descriptor.implemented` is `true` only when `locate()` and `parse()` are fully functional.
- [ ] `locate()` never throws — catch filesystem errors and return `[]` or skip the entry.
- [ ] `parse()` returns `{ ref, entries: [] }` if the session is empty or unreadable; it only throws `NotImplementedError` for stubs.
- [ ] `mtimeMs` is populated from `statSync`; falls back to `0` on failure.
- [ ] All relative imports end in `.js` (ESM only).
- [ ] No `any` — use `unknown` with type guards.
