# Multi-Source Discovery + Local Inference Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `handprint grab` find transcripts from multiple AI tools and extract handprints using a model already on the user's machine — with no external account ever required.

**Architecture:** Three layers. (1) **Source adapters** under `src/sources/` each implement `descriptor` + `locate()` + `parse()` and normalize their tool's transcripts into `TranscriptEntry[]`. (2) A **discovery** function merges all enabled adapters. (3) **Extractor providers** under `src/extractor/` (`local-model` via node-llama-cpp, `host-agent` via an installed CLI) turn transcript windows into `Mark[]`/`Artifact[]`. The signing/store/builder layers are unchanged.

**Tech Stack:** TypeScript (ESM, `node22`), Zod, commander, vitest, tsup. New dep: `node-llama-cpp`. No Cloudflare.

## Global Constraints

- **No `CLOUDFLARE_*` env vars and no `wrangler` are ever read.** `getCloudflareAuth()` and `callWorkersAI()` are deleted.
- **No silent network download.** A local model is downloaded only after explicit user/agent consent.
- **No fallback/default env values.** Per CLAUDE.md: if a required value is missing, fail loudly.
- ESM only: all relative imports end in `.js`. Functional style — pure functions, no classes for business logic, `const`, `unknown` + type guards over `any`/`as`.
- Provenance is two distinct fields, both already in `sourceSchema`: `source.agent` (from the adapter descriptor) and `source.extractor` (from the provider's `label()`).
- All normalized timestamps are ISO 8601 strings.
- Tests live under `tests/` mirroring `src/`. Test imports use the `../../src/...js` form.
- Gate before every commit: `pnpm run fix` then `pnpm run test` (alias for `vitest run`). (`pnpm run fix` may be `tsc --noEmit` + lint; if absent, run `npx tsc --noEmit`.)
- Models cached under `~/.handprint/models/` (honor `HANDPRINT_HOME`).

---

## File Structure

**New:**
- `src/sources/types.ts` — adapter interface, `SessionRef`, `NormalizedSession`, re-export `TranscriptEntry`.
- `src/sources/jsonl-glob.ts` — shared helper for "walk a dir tree, map each JSONL line".
- `src/sources/claude-code.ts` — Claude Code adapter (refactor of existing scanner logic).
- `src/sources/opencode.ts` — opencode adapter.
- `src/sources/codex.ts` — codex stub adapter.
- `src/sources/cursor.ts` — cursor stub adapter.
- `src/sources/index.ts` — adapter registry + `discoverSessions()` + `enabledAdapters()`.
- `src/extractor/types.ts` — `ExtractorProvider`, `RawExtraction`, shared `SYSTEM_PROMPT`, `parseExtractionJson()`.
- `src/extractor/window.ts` — `isNoise`, `chunkEntries`, `buildConversationWindow` (moved from ai-extractor).
- `src/extractor/grammar.ts` — derive a GBNF grammar string from the mark/artifact shape.
- `src/extractor/models.ts` — model registry (id, url, sizeMb, ramGb, notes) + cache helpers.
- `src/extractor/local-model.ts` — node-llama-cpp provider.
- `src/extractor/host-agent.ts` — installed-CLI provider.
- `src/extractor/index.ts` — `resolveProvider()` + `extractHandprints()` orchestration.
- `src/commands/sources.ts` — `handprint sources` command.
- `docs/adding-a-source-adapter.md`, `docs/roadmap-sources.md`, `AGENTS.md` (package root).

**Modified:**
- `packages/types/src/profile.ts` — extend `globalConfigSchema` with optional `extraction` block.
- `src/commands/grab.ts` — use `discoverSessions` + `resolveProvider`; set `source.agent`/`source.extractor`.
- `src/commands/config.ts` — no logic change; new keys flow through generic get/set.
- `bin/handprint.ts` — wire `sources` command + new `grab` flags.
- `src/index.ts` — export new public functions.
- `package.json` — add `node-llama-cpp` dependency.

**Deleted at the end:**
- `src/scanner/ai-extractor.ts` (logic split into `src/sources/*` and `src/extractor/*`).
- `src/scanner/claude-code.ts` (logic moves to `src/sources/claude-code.ts`; keep classify patterns if still referenced, else remove).

---

## Task 1: Extend global config schema for extraction settings

**Files:**
- Modify: `packages/types/src/profile.ts`
- Test: `packages/types/src/__tests__/profile.test.ts`

**Interfaces:**
- Produces: `globalConfigSchema` now accepts optional `extraction: { provider?: 'local' | 'host'; model?: string; agentCli?: 'claude' | 'opencode' | 'codex'; sources?: string[] }`. `GlobalConfig['extraction']` is the typed accessor used by the extractor resolver and config command.

- [ ] **Step 1: Write the failing test**

```ts
// packages/types/src/__tests__/profile.test.ts  (add inside the existing describe)
import { globalConfigSchema } from '../profile.js';

it('accepts an optional extraction block', () => {
  const parsed = globalConfigSchema.parse({
    version: '1.0.0',
    createdAt: '2026-06-27T00:00:00Z',
    identity: { handle: 'a', name: 'b', email: 'c@d.e' },
    hub: { url: 'https://handprint.sh' },
    extraction: { provider: 'local', model: 'qwen2.5-3b-instruct-q4', sources: ['claude-code'] },
  });
  expect(parsed.extraction?.provider).toBe('local');
});

it('still parses config with no extraction block', () => {
  const parsed = globalConfigSchema.parse({
    version: '1.0.0',
    createdAt: '2026-06-27T00:00:00Z',
    identity: { handle: 'a', name: 'b', email: 'c@d.e' },
    hub: { url: 'https://handprint.sh' },
  });
  expect(parsed.extraction).toBeUndefined();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/types && npx vitest run src/__tests__/profile.test.ts`
Expected: FAIL — `extraction` stripped/undefined or unknown key.

- [ ] **Step 3: Add the schema field**

In `packages/types/src/profile.ts`, replace the `globalConfigSchema` definition with:

```ts
export const extractionConfigSchema = z.object({
  provider: z.enum(['local', 'host']).optional(),
  model: z.string().optional(),
  agentCli: z.enum(['claude', 'opencode', 'codex']).optional(),
  sources: z.array(z.string()).optional(),
});
export type ExtractionConfig = z.infer<typeof extractionConfigSchema>;

export const globalConfigSchema = z.object({
  version: z.string(),
  createdAt: z.string(),
  identity: z.object({
    handle: z.string(),
    name: z.string(),
    email: z.string(),
  }),
  social: socialProfileSchema.optional(),
  hub: z.object({
    url: z.string(),
  }),
  extraction: extractionConfigSchema.optional(),
});
export type GlobalConfig = z.infer<typeof globalConfigSchema>;
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/types && npx vitest run src/__tests__/profile.test.ts`
Expected: PASS. Then `cd packages/types && npm run build` so `dist/` is current for the root package.

- [ ] **Step 5: Commit**

```bash
git add packages/types/src/profile.ts packages/types/src/__tests__/profile.test.ts packages/types/dist
git commit -m "feat(types): add optional extraction config block to GlobalConfig"
```

---

## Task 2: Source adapter interface + normalized model

**Files:**
- Create: `src/sources/types.ts`
- Test: `tests/sources/types.test.ts`

**Interfaces:**
- Produces:
  - `TranscriptEntry` = `{ role: 'user' | 'assistant'; text: string; timestamp: string; cwd: string; sessionId: string; gitBranch: string }` (ISO timestamp).
  - `SessionRef` = `{ sourceId: string; sessionId: string; project: string; locator: string; mtimeMs: number }`.
  - `NormalizedSession` = `{ ref: SessionRef; entries: TranscriptEntry[] }`.
  - `SourceCapabilities` = `{ timestamps: 'iso' | 'epoch-ms' | 'none'; session: boolean; project: boolean; gitBranch: boolean; model: boolean }`.
  - `SourceDescriptor` = `{ id: string; displayName: string; sourceAgent: string; capabilities: SourceCapabilities; locations: string[]; implemented: boolean }`.
  - `SourceAdapter` = `{ descriptor: SourceDescriptor; locate(opts?: LocateOpts): SessionRef[]; parse(ref: SessionRef): NormalizedSession }`.
  - `LocateOpts` = `{ homeDir?: string }`.
  - `NotImplementedError` class extending `Error` for stub adapters.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sources/types.test.ts
import { describe, it, expect } from 'vitest';
import { NotImplementedError } from '../../src/sources/types.js';

describe('source types', () => {
  it('NotImplementedError carries the adapter id', () => {
    const err = new NotImplementedError('codex');
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toContain('codex');
    expect(err.message).toContain('adding-a-source-adapter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sources/types.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the module**

```ts
// src/sources/types.ts
export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO 8601
  cwd: string;
  sessionId: string;
  gitBranch: string;
}

export interface SessionRef {
  sourceId: string;
  sessionId: string;
  project: string;
  locator: string;
  mtimeMs: number;
}

export interface NormalizedSession {
  ref: SessionRef;
  entries: TranscriptEntry[];
}

export interface SourceCapabilities {
  timestamps: 'iso' | 'epoch-ms' | 'none';
  session: boolean;
  project: boolean;
  gitBranch: boolean;
  model: boolean;
}

export interface SourceDescriptor {
  id: string;
  displayName: string;
  sourceAgent: string;
  capabilities: SourceCapabilities;
  locations: string[];
  implemented: boolean;
}

export interface LocateOpts {
  homeDir?: string;
}

export interface SourceAdapter {
  descriptor: SourceDescriptor;
  locate(opts?: LocateOpts): SessionRef[];
  parse(ref: SessionRef): NormalizedSession;
}

export class NotImplementedError extends Error {
  constructor(sourceId: string) {
    super(
      `source adapter "${sourceId}" is not implemented yet — see docs/adding-a-source-adapter.md`,
    );
    this.name = 'NotImplementedError';
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sources/types.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/sources/types.ts tests/sources/types.test.ts
git commit -m "feat(sources): add source adapter interface and normalized model"
```

---

## Task 3: Claude Code adapter

**Files:**
- Create: `src/sources/claude-code.ts`
- Test: `tests/sources/claude-code.test.ts`

**Interfaces:**
- Consumes: `SourceAdapter`, `TranscriptEntry`, `SessionRef`, `NormalizedSession` from `./types.js`.
- Produces: `claudeCodeAdapter: SourceAdapter` and `parseClaudeLine(line: string, ref: SessionRef): TranscriptEntry | null` (exported for tests).

- [ ] **Step 1: Write the failing test**

```ts
// tests/sources/claude-code.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeCodeAdapter } from '../../src/sources/claude-code.js';

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-claude-'));
  const proj = join(home, '.claude', 'projects', '-Users-test-app');
  mkdirSync(proj, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use edge JWT instead of the gateway' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Okay, switching to edge JWT.' }] }, timestamp: '2026-06-01T10:00:05Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
  ].join('\n');
  writeFileSync(join(proj, 'sess-1.jsonl'), lines);
  return home;
}

describe('claude-code adapter', () => {
  it('descriptor reports claude-code + iso timestamps', () => {
    expect(claudeCodeAdapter.descriptor.id).toBe('claude-code');
    expect(claudeCodeAdapter.descriptor.sourceAgent).toBe('claude-code');
    expect(claudeCodeAdapter.descriptor.capabilities.timestamps).toBe('iso');
    expect(claudeCodeAdapter.descriptor.implemented).toBe(true);
  });

  it('locates sessions under ~/.claude/projects', () => {
    const home = fixtureHome();
    const refs = claudeCodeAdapter.locate({ homeDir: home });
    expect(refs).toHaveLength(1);
    expect(refs[0].sessionId).toBe('sess-1');
    expect(refs[0].sourceId).toBe('claude-code');
  });

  it('parses a session into normalized entries', () => {
    const home = fixtureHome();
    const ref = claudeCodeAdapter.locate({ homeDir: home })[0];
    const session = claudeCodeAdapter.parse(ref);
    expect(session.entries).toHaveLength(2);
    expect(session.entries[0].role).toBe('user');
    expect(session.entries[0].text).toContain('edge JWT');
    expect(session.entries[1].text).toContain('switching to edge JWT');
    expect(session.entries[0].timestamp).toBe('2026-06-01T10:00:00Z');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sources/claude-code.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the adapter**

```ts
// src/sources/claude-code.ts
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

interface ContentItem {
  type: string;
  text?: string;
}

interface RawEntry {
  type: string;
  message?: { role: string; content: string | ContentItem[] };
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
  gitBranch?: string;
}

function extractText(content: string | ContentItem[]): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .filter((i) => i.type === 'text' && typeof i.text === 'string')
    .map((i) => i.text as string)
    .join('');
}

export function parseClaudeLine(
  line: string,
  ref: SessionRef,
): TranscriptEntry | null {
  try {
    const raw: RawEntry = JSON.parse(line);
    if (raw.type !== 'user' && raw.type !== 'assistant') return null;
    if (!raw.message) return null;
    const text = extractText(raw.message.content);
    if (!text) return null;
    return {
      role: raw.type,
      text,
      timestamp: raw.timestamp ?? '',
      cwd: raw.cwd ?? '',
      sessionId: raw.sessionId ?? ref.sessionId,
      gitBranch: raw.gitBranch ?? '',
    };
  } catch {
    return null;
  }
}

function projectsDir(homeDir: string): string {
  return join(homeDir, '.claude', 'projects');
}

export const claudeCodeAdapter: SourceAdapter = {
  descriptor: {
    id: 'claude-code',
    displayName: 'Claude Code',
    sourceAgent: 'claude-code',
    capabilities: { timestamps: 'iso', session: true, project: true, gitBranch: true, model: false },
    locations: ['~/.claude/projects/*/*.jsonl'],
    implemented: true,
  },

  locate(opts?: LocateOpts): SessionRef[] {
    const home = opts?.homeDir ?? homedir();
    const base = projectsDir(home);
    if (!existsSync(base)) return [];
    const refs: SessionRef[] = [];
    for (const project of readdirSync(base)) {
      const projectDir = join(base, project);
      let files: string[];
      try {
        files = readdirSync(projectDir).filter((f) => f.endsWith('.jsonl'));
      } catch {
        continue;
      }
      for (const file of files) {
        const path = join(projectDir, file);
        let mtimeMs = 0;
        try {
          mtimeMs = statSync(path).mtimeMs;
        } catch {
          /* ignore */
        }
        refs.push({
          sourceId: 'claude-code',
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
    const entries = lines
      .map((l) => parseClaudeLine(l, ref))
      .filter((e): e is TranscriptEntry => e !== null);
    return { ref, entries };
  },
};
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sources/claude-code.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sources/claude-code.ts tests/sources/claude-code.test.ts
git commit -m "feat(sources): claude-code adapter (locate + parse, ISO timestamps)"
```

---

## Task 4: opencode adapter

**Files:**
- Create: `src/sources/opencode.ts`
- Test: `tests/sources/opencode.test.ts`

**Interfaces:**
- Consumes: `SourceAdapter`, `SessionRef`, `NormalizedSession`, `TranscriptEntry` from `./types.js`.
- Produces: `opencodeAdapter: SourceAdapter`.
- Storage layout (verified on disk): base `~/.local/share/opencode/storage`; `session/**/ses_*.json` → `{ id, directory, time }`; `message/<sessionId>/msg_*.json` → `{ id, role, time: { created }, path: { cwd } }`; `part/<messageId>/prt_*.json` → text in parts where `type === 'text'` (field `text`). Timestamps are epoch-ms; convert with `new Date(ms).toISOString()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sources/opencode.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { opencodeAdapter } from '../../src/sources/opencode.js';

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-oc-'));
  const base = join(home, '.local', 'share', 'opencode', 'storage');
  const sid = 'ses_test1';
  mkdirSync(join(base, 'session'), { recursive: true });
  writeFileSync(join(base, 'session', `${sid}.json`), JSON.stringify({ id: sid, directory: '/Users/test/moon', title: 'Arch', time: { created: 1769485100000 } }));

  const mDir = join(base, 'message', sid);
  mkdirSync(mDir, { recursive: true });
  writeFileSync(join(mDir, 'msg_a.json'), JSON.stringify({ id: 'msg_a', sessionID: sid, role: 'user', time: { created: 1769485100000 }, path: { cwd: '/Users/test/moon' } }));
  writeFileSync(join(mDir, 'msg_b.json'), JSON.stringify({ id: 'msg_b', sessionID: sid, role: 'assistant', time: { created: 1769485102000 }, path: { cwd: '/Users/test/moon' } }));

  const pa = join(base, 'part', 'msg_a');
  mkdirSync(pa, { recursive: true });
  writeFileSync(join(pa, 'prt_1.json'), JSON.stringify({ id: 'prt_1', type: 'text', text: 'use drizzle not prisma' }));
  const pb = join(base, 'part', 'msg_b');
  mkdirSync(pb, { recursive: true });
  writeFileSync(join(pb, 'prt_2.json'), JSON.stringify({ id: 'prt_2', type: 'reasoning', text: 'thinking...' }));
  writeFileSync(join(pb, 'prt_3.json'), JSON.stringify({ id: 'prt_3', type: 'text', text: 'Got it, using drizzle.' }));
  return home;
}

describe('opencode adapter', () => {
  it('descriptor reports opencode + epoch-ms', () => {
    expect(opencodeAdapter.descriptor.id).toBe('opencode');
    expect(opencodeAdapter.descriptor.sourceAgent).toBe('opencode');
    expect(opencodeAdapter.descriptor.capabilities.timestamps).toBe('epoch-ms');
    expect(opencodeAdapter.descriptor.implemented).toBe(true);
  });

  it('locates sessions and reads project from directory', () => {
    const refs = opencodeAdapter.locate({ homeDir: fixtureHome() });
    expect(refs).toHaveLength(1);
    expect(refs[0].sessionId).toBe('ses_test1');
    expect(refs[0].project).toContain('moon');
  });

  it('parses messages by joining text parts in time order, dropping non-text parts', () => {
    const home = fixtureHome();
    const ref = opencodeAdapter.locate({ homeDir: home })[0];
    const session = opencodeAdapter.parse(ref);
    expect(session.entries).toHaveLength(2);
    expect(session.entries[0].role).toBe('user');
    expect(session.entries[0].text).toBe('use drizzle not prisma');
    expect(session.entries[1].text).toBe('Got it, using drizzle.');
    expect(session.entries[1].text).not.toContain('thinking');
    expect(session.entries[0].timestamp).toBe(new Date(1769485100000).toISOString());
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sources/opencode.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the adapter**

```ts
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

function storageDir(home: string): string {
  return join(home, '.local', 'share', 'opencode', 'storage');
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8')) as T;
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
      const s = readJson<OcSession>(file);
      if (!s?.id) continue;
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
      .map((f) => readJson<OcMessage>(join(msgDir, f)))
      .filter((m): m is OcMessage => m !== null && (m.role === 'user' || m.role === 'assistant'))
      .sort((a, b) => (a.time?.created ?? 0) - (b.time?.created ?? 0));

    for (const m of messages) {
      const partDir = join(base, 'part', m.id);
      if (!existsSync(partDir)) continue;
      const text = readdirSync(partDir)
        .filter((f) => f.endsWith('.json'))
        .sort()
        .map((f) => readJson<OcPart>(join(partDir, f)))
        .filter((p): p is OcPart => p !== null && p.type === 'text' && typeof p.text === 'string')
        .map((p) => p.text as string)
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sources/opencode.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sources/opencode.ts tests/sources/opencode.test.ts
git commit -m "feat(sources): opencode adapter (message+part assembly, epoch-ms to ISO)"
```

---

## Task 5: codex + cursor stub adapters, registry, and discovery

**Files:**
- Create: `src/sources/codex.ts`, `src/sources/cursor.ts`, `src/sources/index.ts`
- Test: `tests/sources/index.test.ts`

**Interfaces:**
- Consumes: `claudeCodeAdapter`, `opencodeAdapter`, `NotImplementedError`, types.
- Produces:
  - `codexAdapter`, `cursorAdapter`: `SourceAdapter` with `descriptor.implemented = false`; `parse()` throws `NotImplementedError`; `locate()` returns `[]`.
  - `ALL_ADAPTERS: SourceAdapter[]`.
  - `adapterById(id: string): SourceAdapter | undefined`.
  - `enabledAdapters(enabled?: string[]): SourceAdapter[]` — implemented adapters whose id is in `enabled` (or all implemented if `enabled` is undefined).
  - `discoverSessions(opts?: { homeDir?: string; sources?: string[]; sourceId?: string }): SessionRef[]` — merges `locate()` across enabled adapters, sorted by `mtimeMs` desc.

- [ ] **Step 1: Write the failing test**

```ts
// tests/sources/index.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALL_ADAPTERS, adapterById, enabledAdapters, discoverSessions } from '../../src/sources/index.js';

describe('source registry + discovery', () => {
  it('registers four adapters, two implemented', () => {
    expect(ALL_ADAPTERS.map((a) => a.descriptor.id).sort()).toEqual(['claude-code', 'codex', 'cursor', 'opencode']);
    expect(ALL_ADAPTERS.filter((a) => a.descriptor.implemented).map((a) => a.descriptor.id).sort()).toEqual(['claude-code', 'opencode']);
  });

  it('codex stub throws NotImplementedError on parse', () => {
    const codex = adapterById('codex')!;
    expect(() => codex.parse({ sourceId: 'codex', sessionId: 'x', project: 'p', locator: 'l', mtimeMs: 0 })).toThrow(/not implemented/);
  });

  it('enabledAdapters filters to implemented and to the allow-list', () => {
    expect(enabledAdapters().map((a) => a.descriptor.id).sort()).toEqual(['claude-code', 'opencode']);
    expect(enabledAdapters(['opencode']).map((a) => a.descriptor.id)).toEqual(['opencode']);
    expect(enabledAdapters(['codex']).map((a) => a.descriptor.id)).toEqual([]); // codex not implemented
  });

  it('discoverSessions merges and sorts by mtime desc', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-disc-'));
    const proj = join(home, '.claude', 'projects', '-Users-test-app');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'sess-1.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello there friend' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }));
    const refs = discoverSessions({ homeDir: home });
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].sourceId).toBe('claude-code');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/sources/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create stubs and registry**

```ts
// src/sources/codex.ts
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SourceAdapter, SessionRef, NormalizedSession, LocateOpts } from './types.js';
import { NotImplementedError } from './types.js';

export const codexAdapter: SourceAdapter = {
  descriptor: {
    id: 'codex',
    displayName: 'Codex CLI',
    sourceAgent: 'codex',
    capabilities: { timestamps: 'iso', session: true, project: true, gitBranch: false, model: true },
    locations: ['~/.codex/sessions'],
    implemented: false,
  },
  locate(_opts?: LocateOpts): SessionRef[] {
    // Sessions live under ~/.codex/sessions; enumeration is wired here once the
    // on-disk format is confirmed. Until then discovery skips this source.
    void join(homedir(), '.codex', 'sessions');
    return [];
  },
  parse(_ref: SessionRef): NormalizedSession {
    throw new NotImplementedError('codex');
  },
};
```

```ts
// src/sources/cursor.ts
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SourceAdapter, SessionRef, NormalizedSession, LocateOpts } from './types.js';
import { NotImplementedError } from './types.js';

export const cursorAdapter: SourceAdapter = {
  descriptor: {
    id: 'cursor',
    displayName: 'Cursor',
    sourceAgent: 'cursor',
    capabilities: { timestamps: 'epoch-ms', session: true, project: true, gitBranch: false, model: true },
    locations: ['~/Library/Application Support/Cursor (SQLite state store)'],
    implemented: false,
  },
  locate(_opts?: LocateOpts): SessionRef[] {
    // Cursor persists chat in a SQLite store under its app-support dir; reading it
    // needs a sqlite dependency + schema mapping, wired in a follow-up.
    void join(homedir(), 'Library', 'Application Support', 'Cursor');
    return [];
  },
  parse(_ref: SessionRef): NormalizedSession {
    throw new NotImplementedError('cursor');
  },
};
```

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/sources/index.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/sources/codex.ts src/sources/cursor.ts src/sources/index.ts tests/sources/index.test.ts
git commit -m "feat(sources): codex/cursor stubs, adapter registry, discoverSessions"
```

---

## Task 6: Extractor types, window builder, and JSON parsing

**Files:**
- Create: `src/extractor/types.ts`, `src/extractor/window.ts`
- Test: `tests/extractor/window.test.ts`, `tests/extractor/types.test.ts`

**Interfaces:**
- Consumes: `TranscriptEntry` from `../sources/types.js`; `markSchema`, `artifactSchema`, `Mark`, `Artifact` from `@handprint/types`.
- Produces:
  - `RawExtraction` = `{ marks: Mark[]; artifacts: Artifact[]; timestamp: string }`.
  - `ExtractorProvider` = `{ id: string; label(): string; isAvailable(): Promise<boolean>; extract(window: string, system: string): Promise<RawExtraction[]> }`.
  - `SYSTEM_PROMPT: string` (the detector instructions, moved verbatim from ai-extractor).
  - `parseExtractionJson(text: string): RawExtraction[]` — finds the first JSON array, validates each mark/artifact with the Zod schemas, drops invalid entries and entries with zero marks.
  - `window.ts`: `isNoise(e)`, `chunkEntries(entries, maxChars?)`, `buildConversationWindow(entries, maxChars?)` (moved from ai-extractor, importing `TranscriptEntry` from sources).

- [ ] **Step 1: Write the failing tests**

```ts
// tests/extractor/types.test.ts
import { describe, it, expect } from 'vitest';
import { parseExtractionJson, SYSTEM_PROMPT } from '../../src/extractor/types.js';

describe('parseExtractionJson', () => {
  it('parses valid marks and drops invalid ones', () => {
    const text = 'noise before [{"marks":[{"type":"choice","subtype":"override","note":"chose edge JWT"},{"type":"bogus"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}] noise after';
    const out = parseExtractionJson(text);
    expect(out).toHaveLength(1);
    expect(out[0].marks).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose edge JWT');
  });

  it('drops extractions with zero valid marks', () => {
    const text = '[{"marks":[{"type":"bogus"}],"artifacts":[],"timestamp":"t"}]';
    expect(parseExtractionJson(text)).toHaveLength(0);
  });

  it('returns [] when no array present', () => {
    expect(parseExtractionJson('sorry, nothing here')).toEqual([]);
  });

  it('exposes a non-empty system prompt', () => {
    expect(SYSTEM_PROMPT).toContain('handprint');
  });
});
```

```ts
// tests/extractor/window.test.ts
import { describe, it, expect } from 'vitest';
import { isNoise, chunkEntries, buildConversationWindow } from '../../src/extractor/window.js';
import type { TranscriptEntry } from '../../src/sources/types.js';

const mk = (role: 'user' | 'assistant', text: string): TranscriptEntry => ({ role, text, timestamp: '2026-06-01T10:00:00Z', cwd: '', sessionId: 's', gitBranch: '' });

describe('window builder', () => {
  it('flags system-reminder and short noise', () => {
    expect(isNoise(mk('user', '<system-reminder>hi</system-reminder>'))).toBe(true);
    expect(isNoise(mk('user', 'ok'))).toBe(true);
    expect(isNoise(mk('user', 'use drizzle instead of prisma for the schema'))).toBe(false);
  });

  it('builds a window with HUMAN/AI labels', () => {
    const w = buildConversationWindow([mk('user', 'use drizzle instead of prisma for the schema')]);
    expect(w).toContain('HUMAN:');
  });

  it('chunks by size', () => {
    const many = Array.from({ length: 50 }, (_, i) => mk('user', `decision number ${i} about architecture choices`));
    const chunks = chunkEntries(many, 200);
    expect(chunks.length).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/extractor/`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `window.ts`**

```ts
// src/extractor/window.ts
import type { TranscriptEntry } from '../sources/types.js';

export function isNoise(entry: TranscriptEntry): boolean {
  const t = entry.text;
  if (t.startsWith('Base directory for this skill')) return true;
  if (t.startsWith('<local-command-caveat>')) return true;
  if (t.startsWith('<command-name>')) return true;
  if (t.startsWith('<task-notification>')) return true;
  if (t.startsWith('This session is being continued from')) return true;
  if (t.startsWith('<system-reminder>')) return true;
  if (t.length < 15) return true;
  if (entry.role === 'user' && t.startsWith('{')) return true;
  if (entry.role === 'user' && t.includes('tool_result')) return true;
  return false;
}

export function buildConversationWindow(
  entries: TranscriptEntry[],
  maxChars = 12000,
): string {
  const clean = entries.filter((e) => !isNoise(e));
  const lines: string[] = [];
  let total = 0;
  for (const e of clean) {
    const role = e.role === 'user' ? 'HUMAN' : 'AI';
    const ts = e.timestamp.slice(0, 19);
    const text = e.text.slice(0, 600);
    const line = `[${ts}] ${role}: ${text}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length;
  }
  return lines.join('\n\n');
}

export function chunkEntries(
  entries: TranscriptEntry[],
  maxCharsPerChunk = 10000,
): TranscriptEntry[][] {
  const clean = entries.filter((e) => !isNoise(e));
  const chunks: TranscriptEntry[][] = [];
  let current: TranscriptEntry[] = [];
  let currentSize = 0;
  for (const e of clean) {
    const size = e.text.slice(0, 600).length + 50;
    if (currentSize + size > maxCharsPerChunk && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(e);
    currentSize += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
```

- [ ] **Step 4: Create `types.ts`**

```ts
// src/extractor/types.ts
import type { Mark, Artifact } from '@handprint/types';
import { markSchema, artifactSchema } from '@handprint/types';

export interface RawExtraction {
  marks: Mark[];
  artifacts: Artifact[];
  timestamp: string;
}

export interface ExtractorProvider {
  id: string;
  label(): string;
  isAvailable(): Promise<boolean>;
  extract(window: string, system: string): Promise<RawExtraction[]>;
}

export const SYSTEM_PROMPT = `You are a handprint detector. You analyze conversations between a human and an AI assistant to identify moments of human judgment — decisions where the human steered the work.

There are three types of marks:

1. **vision** — What the human wants to achieve.
   Subtypes: goal, direction, principle

2. **choice** — Decisions the human made.
   Subtypes: approval, override, rejection, constraint, inquiry

3. **method** — Tools and knowledge the human applied.
   Subtypes: tool, knowledge, process

For each decision moment, return an object with:
- marks: array of { type, subtype, note } — note is 1-280 chars describing the decision
- artifacts: array of { type, uri } — any outputs referenced (git-commit, file, url, deployment, etc.)
- timestamp: the ISO timestamp from the conversation

IMPORTANT:
- Only flag moments where a HUMAN made a real decision
- Routine instructions are NOT handprints
- Simple approvals without constraints are NOT handprints
- "Never do X" / "always do Y" = choice/constraint
- Tool/framework selections = method/tool or method/process
- Each note should be a concise third-person description of what the human decided

Respond ONLY with a JSON array. No markdown. If none found, return [].`;

export function parseExtractionJson(text: string): RawExtraction[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const out: RawExtraction[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as { marks?: unknown[]; artifacts?: unknown[]; timestamp?: string };
    const marks: Mark[] = [];
    const artifacts: Artifact[] = [];
    for (const m of rec.marks ?? []) {
      const parsed = markSchema.safeParse(m);
      if (parsed.success) marks.push(parsed.data);
    }
    for (const a of rec.artifacts ?? []) {
      const parsed = artifactSchema.safeParse(a);
      if (parsed.success) artifacts.push(parsed.data);
    }
    if (marks.length === 0) continue;
    out.push({ marks, artifacts, timestamp: rec.timestamp ?? new Date().toISOString() });
  }
  return out;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/extractor/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/extractor/types.ts src/extractor/window.ts tests/extractor/
git commit -m "feat(extractor): provider interface, window builder, JSON parsing"
```

---

## Task 7: Model registry + GBNF grammar

**Files:**
- Create: `src/extractor/models.ts`, `src/extractor/grammar.ts`
- Test: `tests/extractor/models.test.ts`, `tests/extractor/grammar.test.ts`

**Interfaces:**
- Produces:
  - `models.ts`: `ModelEntry` = `{ id: string; displayName: string; url: string; sizeMb: number; ramGb: number; notes: string }`; `MODELS: ModelEntry[]`; `DEFAULT_MODEL_ID: string`; `modelById(id)`; `modelsDir(homeDir?)` → `<HANDPRINT_HOME|~/.handprint>/models`; `modelPath(entry, homeDir?)` → cached `.gguf` path; `isModelDownloaded(entry, homeDir?)`.
  - `grammar.ts`: `EXTRACTION_GBNF: string` — a GBNF grammar constraining output to an array of `{ marks:[{type,subtype,note}], artifacts:[{type,uri}], timestamp }`, with `type`/`subtype` enums matching the Zod schema.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/extractor/models.test.ts
import { describe, it, expect } from 'vitest';
import { MODELS, DEFAULT_MODEL_ID, modelById, modelsDir, modelPath } from '../../src/extractor/models.js';

describe('model registry', () => {
  it('has a default model present in the registry', () => {
    expect(modelById(DEFAULT_MODEL_ID)).toBeDefined();
  });
  it('every model entry has a download url and size', () => {
    for (const m of MODELS) {
      expect(m.url).toMatch(/^https?:\/\//);
      expect(m.sizeMb).toBeGreaterThan(0);
    }
  });
  it('modelPath lives under the handprint home models dir', () => {
    const entry = modelById(DEFAULT_MODEL_ID)!;
    const dir = modelsDir('/tmp/hp-home');
    expect(dir).toBe('/tmp/hp-home/models');
    expect(modelPath(entry, '/tmp/hp-home').startsWith(dir)).toBe(true);
    expect(modelPath(entry, '/tmp/hp-home')).toMatch(/\.gguf$/);
  });
});
```

```ts
// tests/extractor/grammar.test.ts
import { describe, it, expect } from 'vitest';
import { EXTRACTION_GBNF } from '../../src/extractor/grammar.js';

describe('extraction grammar', () => {
  it('constrains mark type and subtype to the known enums', () => {
    expect(EXTRACTION_GBNF).toContain('"vision"');
    expect(EXTRACTION_GBNF).toContain('"choice"');
    expect(EXTRACTION_GBNF).toContain('"method"');
    expect(EXTRACTION_GBNF).toContain('"override"');
    expect(EXTRACTION_GBNF).toContain('root');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/extractor/models.test.ts tests/extractor/grammar.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 3: Create `models.ts`**

```ts
// src/extractor/models.ts
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';

export interface ModelEntry {
  id: string;
  displayName: string;
  url: string; // direct GGUF download
  sizeMb: number;
  ramGb: number;
  notes: string;
}

// Lightest-appropriate-first. The grab flow presents these and asks the
// user/agent to choose the smallest one their machine can run.
export const MODELS: ModelEntry[] = [
  {
    id: 'qwen2.5-1.5b-instruct-q4',
    displayName: 'Qwen2.5 1.5B Instruct (Q4_K_M)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf',
    sizeMb: 1100,
    ramGb: 2,
    notes: 'Lightest. Good for short structured extraction on 8GB machines / no GPU.',
  },
  {
    id: 'qwen2.5-3b-instruct-q4',
    displayName: 'Qwen2.5 3B Instruct (Q4_K_M)',
    url: 'https://huggingface.co/Qwen/Qwen2.5-3B-Instruct-GGUF/resolve/main/qwen2.5-3b-instruct-q4_k_m.gguf',
    sizeMb: 2000,
    ramGb: 4,
    notes: 'Recommended default. Strong JSON adherence; fast on Apple Silicon.',
  },
  {
    id: 'llama-3.2-3b-instruct-q4',
    displayName: 'Llama 3.2 3B Instruct (Q4_K_M)',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    sizeMb: 2000,
    ramGb: 4,
    notes: 'Alternative 3B if Qwen output quality is poor for your transcripts.',
  },
];

export const DEFAULT_MODEL_ID = 'qwen2.5-3b-instruct-q4';

export function modelById(id: string): ModelEntry | undefined {
  return MODELS.find((m) => m.id === id);
}

export function modelsDir(homeDir?: string): string {
  const base = homeDir ?? process.env.HANDPRINT_HOME ?? join(homedir(), '.handprint');
  return join(base, 'models');
}

export function modelPath(entry: ModelEntry, homeDir?: string): string {
  return join(modelsDir(homeDir), `${entry.id}.gguf`);
}

export function isModelDownloaded(entry: ModelEntry, homeDir?: string): boolean {
  return existsSync(modelPath(entry, homeDir));
}
```

- [ ] **Step 4: Create `grammar.ts`**

```ts
// src/extractor/grammar.ts
// GBNF grammar passed to node-llama-cpp so the local model can only emit JSON
// that matches our Mark[]/Artifact[] shape. Enums mirror @handprint/types.
export const EXTRACTION_GBNF = `
root        ::= "[" ws ( extraction ( ws "," ws extraction )* )? ws "]"
extraction  ::= "{" ws
                  "\\"marks\\"" ws ":" ws markarr ws "," ws
                  "\\"artifacts\\"" ws ":" ws artarr ws "," ws
                  "\\"timestamp\\"" ws ":" ws string
                ws "}"
markarr     ::= "[" ws ( mark ( ws "," ws mark )* )? ws "]"
mark        ::= "{" ws
                  "\\"type\\"" ws ":" ws marktype ws "," ws
                  "\\"subtype\\"" ws ":" ws subtype ws "," ws
                  "\\"note\\"" ws ":" ws string
                ws "}"
marktype    ::= "\\"vision\\"" | "\\"choice\\"" | "\\"method\\""
subtype     ::= "\\"goal\\"" | "\\"direction\\"" | "\\"principle\\""
             | "\\"approval\\"" | "\\"override\\"" | "\\"rejection\\"" | "\\"constraint\\"" | "\\"inquiry\\""
             | "\\"tool\\"" | "\\"knowledge\\"" | "\\"process\\""
artarr      ::= "[" ws ( artifact ( ws "," ws artifact )* )? ws "]"
artifact    ::= "{" ws
                  "\\"type\\"" ws ":" ws arttype ws "," ws
                  "\\"uri\\"" ws ":" ws string
                ws "}"
arttype     ::= "\\"git-commit\\"" | "\\"git-repo\\"" | "\\"file\\"" | "\\"url\\"" | "\\"deployment\\"" | "\\"c2pa\\"" | "\\"custom\\""
string      ::= "\\"" ( [^"\\\\] | "\\\\" . )* "\\""
ws          ::= [ \\t\\n]*
`.trim();
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/extractor/models.test.ts tests/extractor/grammar.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/extractor/models.ts src/extractor/grammar.ts tests/extractor/models.test.ts tests/extractor/grammar.test.ts
git commit -m "feat(extractor): model registry + GBNF grammar for structured output"
```

---

## Task 8: Add node-llama-cpp dependency + local-model provider

**Files:**
- Modify: `package.json`
- Create: `src/extractor/local-model.ts`
- Test: `tests/extractor/local-model.test.ts`

**Interfaces:**
- Consumes: `ExtractorProvider`, `RawExtraction`, `parseExtractionJson` from `./types.js`; `models.ts`; `EXTRACTION_GBNF` from `./grammar.js`.
- Produces: `createLocalProvider(opts: { modelId: string; homeDir?: string; onDownload?: (e: ModelEntry) => Promise<boolean> }): ExtractorProvider`. `label()` returns `local:<modelId>`. `isAvailable()` is true when the model file exists OR `onDownload` is provided and succeeds. `extract()` lazily loads the model via `node-llama-cpp`, runs with `EXTRACTION_GBNF`, and returns `parseExtractionJson(rawText)`.
- `ensureModel(entry, homeDir, onDownload)` is exported for testing the download-gating logic (pure w.r.t. fs + injected fetch is out of scope; test only the "already downloaded" and "no consent" branches).

- [ ] **Step 1: Add the dependency**

Run:
```bash
npm pkg set dependencies.node-llama-cpp="^3.0.0"
npm install
```
Expected: `node-llama-cpp` resolves and installs prebuilt binaries.

- [ ] **Step 2: Write the failing test**

```ts
// tests/extractor/local-model.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createLocalProvider } from '../../src/extractor/local-model.js';
import { DEFAULT_MODEL_ID, modelPath } from '../../src/extractor/models.js';

describe('local-model provider', () => {
  it('labels itself local:<modelId>', () => {
    const p = createLocalProvider({ modelId: DEFAULT_MODEL_ID, homeDir: '/tmp/x' });
    expect(p.label()).toBe(`local:${DEFAULT_MODEL_ID}`);
  });

  it('isAvailable true when the model file already exists', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-lm-'));
    mkdirSync(join(home, 'models'), { recursive: true });
    // create a placeholder file at the model path so the existence check passes
    const { modelById } = await import('../../src/extractor/models.js');
    writeFileSync(modelPath(modelById(DEFAULT_MODEL_ID)!, home), 'gguf-bytes');
    const p = createLocalProvider({ modelId: DEFAULT_MODEL_ID, homeDir: home });
    expect(await p.isAvailable()).toBe(true);
  });

  it('isAvailable false when not downloaded and no consent callback', async () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-lm2-'));
    const p = createLocalProvider({ modelId: DEFAULT_MODEL_ID, homeDir: home });
    expect(await p.isAvailable()).toBe(false);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/extractor/local-model.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 4: Create the provider**

```ts
// src/extractor/local-model.ts
import { createWriteStream, mkdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { EXTRACTION_GBNF } from './grammar.js';
import {
  type ModelEntry,
  modelById,
  modelPath,
  modelsDir,
  isModelDownloaded,
} from './models.js';

export interface LocalProviderOpts {
  modelId: string;
  homeDir?: string;
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
}

export async function ensureModel(
  entry: ModelEntry,
  homeDir: string | undefined,
  onDownload?: (entry: ModelEntry) => Promise<boolean>,
): Promise<boolean> {
  if (isModelDownloaded(entry, homeDir)) return true;
  if (!onDownload) return false;
  const consent = await onDownload(entry);
  if (!consent) return false;
  mkdirSync(modelsDir(homeDir), { recursive: true });
  const res = await fetch(entry.url);
  if (!res.ok || !res.body) {
    throw new Error(`model download failed (${res.status}) for ${entry.id}`);
  }
  const dest = createWriteStream(modelPath(entry, homeDir));
  await pipeline(Readable.fromWeb(res.body as unknown as Parameters<typeof Readable.fromWeb>[0]), dest);
  return true;
}

export function createLocalProvider(opts: LocalProviderOpts): ExtractorProvider {
  const entry = modelById(opts.modelId);
  if (!entry) throw new Error(`unknown model: ${opts.modelId}`);

  return {
    id: 'local-model',
    label: () => `local:${entry.id}`,

    async isAvailable(): Promise<boolean> {
      if (isModelDownloaded(entry, opts.homeDir)) return true;
      if (!opts.onDownload) return false;
      return ensureModel(entry, opts.homeDir, opts.onDownload);
    },

    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const ready = await ensureModel(entry, opts.homeDir, opts.onDownload);
      if (!ready) throw new Error('local model not available — run "handprint grab" to download it');

      // Lazy import keeps the native module off the hot path for non-local runs.
      const { getLlama, LlamaChatSession, LlamaGrammar } = await import('node-llama-cpp');
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: modelPath(entry, opts.homeDir) });
      const context = await model.createContext();
      const grammar = new LlamaGrammar(llama, { grammar: EXTRACTION_GBNF });
      const session = new LlamaChatSession({
        contextSequence: context.getSequence(),
        systemPrompt: system,
      });
      const prompt = `Analyze this conversation and extract any handprints (human decision moments):\n\n${window}`;
      const answer = await session.prompt(prompt, { grammar, maxTokens: 4096 });
      await context.dispose();
      await model.dispose();
      return parseExtractionJson(answer);
    },
  };
}
```

> Note: `node-llama-cpp` v3 API surface (`getLlama`, `LlamaChatSession`, `LlamaGrammar`) — if the installed version differs, adapt the lazy-import block to that version's grammar API; the rest of the provider is version-agnostic. Confirm against `node_modules/node-llama-cpp` after install.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/extractor/local-model.test.ts`
Expected: PASS (3 tests). The real model load is not exercised in unit tests.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/extractor/local-model.ts tests/extractor/local-model.test.ts
git commit -m "feat(extractor): local-model provider via node-llama-cpp with consent-gated download"
```

---

## Task 9: host-agent provider

**Files:**
- Create: `src/extractor/host-agent.ts`
- Test: `tests/extractor/host-agent.test.ts`

**Interfaces:**
- Consumes: `ExtractorProvider`, `RawExtraction`, `parseExtractionJson` from `./types.js`.
- Produces:
  - `AGENT_CLIS` = ordered list `[{ id: 'claude', bin: 'claude', buildArgs(system, prompt) }, { id: 'opencode', bin: 'opencode', ... }, { id: 'codex', bin: 'codex', ... }]`.
  - `detectAgentCli(runner?): AgentCliSpec | undefined` — first CLI found on `PATH` (uses `which`/`where`).
  - `createHostProvider(opts: { cli?: 'claude' | 'opencode' | 'codex'; run?: Runner; detect?: () => AgentCliSpec | undefined }): ExtractorProvider`. `Runner` = `(bin: string, args: string[], input: string) => Promise<string>` (default spawns via `node:child_process.execFile`-style, passing the prompt). `label()` returns `host:<cli>`. `isAvailable()` true when a CLI is selected/detected. `extract()` runs the CLI and returns `parseExtractionJson(stdout)`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/extractor/host-agent.test.ts
import { describe, it, expect } from 'vitest';
import { createHostProvider } from '../../src/extractor/host-agent.js';

describe('host-agent provider', () => {
  it('labels itself host:<cli> and is available when a cli is detected', async () => {
    const p = createHostProvider({ detect: () => ({ id: 'claude', bin: 'claude', buildArgs: () => [] }) });
    expect(p.label()).toBe('host:claude');
    expect(await p.isAvailable()).toBe(true);
  });

  it('is unavailable when nothing is detected', async () => {
    const p = createHostProvider({ detect: () => undefined });
    expect(await p.isAvailable()).toBe(false);
  });

  it('extracts by running the injected runner and parsing JSON from stdout', async () => {
    const fakeRunner = async () =>
      '```json\n[{"marks":[{"type":"method","subtype":"tool","note":"chose drizzle"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]\n```';
    const p = createHostProvider({
      detect: () => ({ id: 'opencode', bin: 'opencode', buildArgs: () => ['run'] }),
      run: fakeRunner,
    });
    const out = await p.extract('window text', 'system text');
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose drizzle');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extractor/host-agent.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the provider**

```ts
// src/extractor/host-agent.ts
import { execFile } from 'node:child_process';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';

export interface AgentCliSpec {
  id: 'claude' | 'opencode' | 'codex';
  bin: string;
  buildArgs(system: string, prompt: string): string[];
}

export type Runner = (bin: string, args: string[], input: string) => Promise<string>;

// Each CLI takes a single prompt and prints the model's text to stdout.
export const AGENT_CLIS: AgentCliSpec[] = [
  { id: 'claude', bin: 'claude', buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`] },
  { id: 'opencode', bin: 'opencode', buildArgs: (system, prompt) => ['run', `${system}\n\n${prompt}`] },
  { id: 'codex', bin: 'codex', buildArgs: (system, prompt) => ['exec', `${system}\n\n${prompt}`] },
];

function onPath(bin: string): boolean {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    // execFileSync throws if not found
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('node:child_process').execFileSync(probe, [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function detectAgentCli(): AgentCliSpec | undefined {
  return AGENT_CLIS.find((c) => onPath(c.bin));
}

const defaultRunner: Runner = (bin, args) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });

export interface HostProviderOpts {
  cli?: 'claude' | 'opencode' | 'codex';
  run?: Runner;
  detect?: () => AgentCliSpec | undefined;
}

export function createHostProvider(opts: HostProviderOpts = {}): ExtractorProvider {
  const detect = opts.detect ?? detectAgentCli;
  const run = opts.run ?? defaultRunner;
  const resolveSpec = (): AgentCliSpec | undefined => {
    if (opts.cli) return AGENT_CLIS.find((c) => c.id === opts.cli);
    return detect();
  };
  const spec = resolveSpec();

  return {
    id: 'host-agent',
    label: () => `host:${spec?.id ?? 'none'}`,
    async isAvailable(): Promise<boolean> {
      return resolveSpec() !== undefined;
    },
    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const s = resolveSpec();
      if (!s) throw new Error('no agent CLI found on PATH (claude / opencode / codex)');
      const prompt = `Analyze this conversation and extract any handprints (human decision moments):\n\n${window}`;
      const stdout = await run(s.bin, s.buildArgs(system, prompt), prompt);
      return parseExtractionJson(stdout);
    },
  };
}
```

> Note: replace the `require('node:child_process')` probe with a top-level `import { execFileSync } from 'node:child_process'` and call it directly — shown inline only to keep the snippet local. Use the ESM import in the real file (no `require` in ESM).

- [ ] **Step 4: Fix the ESM import (apply the note)**

Replace the `onPath` body's probe with the imported `execFileSync`:

```ts
import { execFile, execFileSync } from 'node:child_process';
// ...
function onPath(bin: string): boolean {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(probe, [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run tests/extractor/host-agent.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/extractor/host-agent.ts tests/extractor/host-agent.test.ts
git commit -m "feat(extractor): host-agent provider (claude/opencode/codex CLI, injectable runner)"
```

---

## Task 10: Extractor resolver + orchestration

**Files:**
- Create: `src/extractor/index.ts`
- Test: `tests/extractor/index.test.ts`

**Interfaces:**
- Consumes: providers from `./local-model.js` + `./host-agent.js`; `chunkEntries`, `buildConversationWindow` from `./window.js`; `SYSTEM_PROMPT`, `RawExtraction` from `./types.js`; `ExtractionConfig` from `@handprint/types`; `TranscriptEntry` from `../sources/types.js`.
- Produces:
  - `resolveProvider(opts: { config?: ExtractionConfig; homeDir?: string; onDownload?; forceProvider?: 'local' | 'host' }): ExtractorProvider` — picks `local` or `host` from `forceProvider` ?? `config.provider`, building the matching provider; defaults to `local` with `DEFAULT_MODEL_ID` when unset.
  - `extractFromEntries(entries: TranscriptEntry[], provider: ExtractorProvider): Promise<RawExtraction[]>` — chunks entries, builds a window per chunk, calls `provider.extract`, flattens; logs progress to `console.error` per chunk.

- [ ] **Step 1: Write the failing test**

```ts
// tests/extractor/index.test.ts
import { describe, it, expect } from 'vitest';
import { resolveProvider, extractFromEntries } from '../../src/extractor/index.js';
import type { ExtractorProvider } from '../../src/extractor/types.js';
import type { TranscriptEntry } from '../../src/sources/types.js';

const mk = (role: 'user' | 'assistant', text: string): TranscriptEntry => ({ role, text, timestamp: '2026-06-01T10:00:00Z', cwd: '', sessionId: 's', gitBranch: '' });

describe('extractor resolver', () => {
  it('resolves host provider when config.provider=host', () => {
    const p = resolveProvider({ config: { provider: 'host', agentCli: 'claude' } });
    expect(p.id).toBe('host-agent');
  });

  it('resolves local provider by default', () => {
    const p = resolveProvider({ config: {}, homeDir: '/tmp/hp' });
    expect(p.id).toBe('local-model');
    expect(p.label()).toMatch(/^local:/);
  });

  it('extractFromEntries fans chunks through the provider', async () => {
    const fake: ExtractorProvider = {
      id: 'fake',
      label: () => 'fake',
      isAvailable: async () => true,
      extract: async () => [{ marks: [{ type: 'choice', subtype: 'override', note: 'n' }], artifacts: [], timestamp: 't' }],
    };
    const entries = [mk('user', 'use drizzle instead of prisma for the schema layer')];
    const out = await extractFromEntries(entries, fake);
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('n');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/extractor/index.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the resolver**

```ts
// src/extractor/index.ts
import type { ExtractionConfig } from '@handprint/types';
import type { TranscriptEntry } from '../sources/types.js';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { SYSTEM_PROMPT } from './types.js';
import { chunkEntries, buildConversationWindow } from './window.js';
import { createLocalProvider, type LocalProviderOpts } from './local-model.js';
import { createHostProvider } from './host-agent.js';
import { DEFAULT_MODEL_ID, type ModelEntry } from './models.js';

export * from './types.js';
export { MODELS, DEFAULT_MODEL_ID, modelById, isModelDownloaded } from './models.js';
export { detectAgentCli } from './host-agent.js';

export interface ResolveOpts {
  config?: ExtractionConfig;
  homeDir?: string;
  onDownload?: LocalProviderOpts['onDownload'];
  forceProvider?: 'local' | 'host';
}

export function resolveProvider(opts: ResolveOpts = {}): ExtractorProvider {
  const provider = opts.forceProvider ?? opts.config?.provider ?? 'local';
  if (provider === 'host') {
    return createHostProvider({ cli: opts.config?.agentCli });
  }
  return createLocalProvider({
    modelId: opts.config?.model ?? DEFAULT_MODEL_ID,
    homeDir: opts.homeDir,
    onDownload: opts.onDownload,
  });
}

export async function extractFromEntries(
  entries: TranscriptEntry[],
  provider: ExtractorProvider,
): Promise<RawExtraction[]> {
  const chunks = chunkEntries(entries);
  const all: RawExtraction[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const window = buildConversationWindow(chunks[i]);
    if (!window.trim()) continue;
    console.error(`  chunk ${i + 1}/${chunks.length} (${chunks[i].length} messages)...`);
    try {
      const out = await provider.extract(window, SYSTEM_PROMPT);
      all.push(...out);
    } catch (err) {
      console.error(`  chunk ${i + 1} error: ${(err as Error).message}`);
    }
  }
  return all;
}

export type { ModelEntry };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/extractor/index.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/extractor/index.ts tests/extractor/index.test.ts
git commit -m "feat(extractor): provider resolver + chunked extraction orchestration"
```

---

## Task 11: Refactor `grab` to use discovery + providers

**Files:**
- Modify: `src/commands/grab.ts`
- Test: `tests/commands/grab.test.ts`

**Interfaces:**
- Consumes: `discoverSessions`, `adapterById` from `../sources/index.js`; `resolveProvider`, `extractFromEntries` from `../extractor/index.js`; `loadGlobalConfig` from `../dirs/global.js`; `buildHandprint` from `../builder/handprint.js`.
- Produces: `grab(cwd, options?)` with options `{ homeDir?: string; limit?: number; dryRun?: boolean; source?: string; extractor?: 'local' | 'host'; provider?: ExtractorProvider; onDownload? }`. `GrabResult` unchanged in shape but each detail also records `agent` and `extractor` strings. Sets `source.agent` from the session's adapter descriptor and `source.extractor` from `provider.label()`.

- [ ] **Step 1: Write the failing test**

```ts
// tests/commands/grab.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grab } from '../../src/commands/grab.js';
import type { ExtractorProvider } from '../../src/extractor/types.js';

function claudeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-grab-'));
  const proj = join(home, '.claude', 'projects', '-Users-test-app');
  mkdirSync(proj, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use edge JWT instead of the centralized gateway' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Switching to edge JWT validation.' }] }, timestamp: '2026-06-01T10:00:05Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
  ].join('\n');
  writeFileSync(join(proj, 'sess-1.jsonl'), lines);
  return home;
}

const fakeProvider: ExtractorProvider = {
  id: 'fake',
  label: () => 'local:fake-model',
  isAvailable: async () => true,
  extract: async () => [{ marks: [{ type: 'choice', subtype: 'override', note: 'chose edge JWT over gateway' }], artifacts: [], timestamp: '2026-06-01T10:00:00Z' }],
};

describe('grab (dry-run, injected provider)', () => {
  it('discovers claude sessions and records agent + extractor provenance', async () => {
    const res = await grab('/Users/test/app', { homeDir: claudeHome(), dryRun: true, provider: fakeProvider });
    expect(res.handprintsCreated).toBe(1);
    expect(res.details[0].agent).toBe('claude-code');
    expect(res.details[0].extractor).toBe('local:fake-model');
    expect(res.details[0].marks[0].note).toContain('edge JWT');
  });

  it('honors --source filter (opencode → no claude sessions found)', async () => {
    const res = await grab('/Users/test/app', { homeDir: claudeHome(), dryRun: true, source: 'opencode', provider: fakeProvider });
    expect(res.sessionsScanned).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/commands/grab.test.ts`
Expected: FAIL — `grab` signature/behavior mismatch (no `homeDir`/`provider`/`agent`/`extractor`).

- [ ] **Step 3: Rewrite `grab.ts`**

```ts
// src/commands/grab.ts
import { discoverSessions, adapterById } from '../sources/index.js';
import type { TranscriptEntry } from '../sources/types.js';
import { resolveProvider, extractFromEntries } from '../extractor/index.js';
import type { ExtractorProvider } from '../extractor/types.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot } from '../dirs/project.js';
import { isGlobalInitialized, loadGlobalConfig } from '../dirs/global.js';
import type { ModelEntry } from '../extractor/models.js';

export interface GrabResult {
  handprintsCreated: number;
  sessionsScanned: number;
  details: Array<{
    hash: string;
    agent: string;
    extractor: string;
    marks: Array<{ type: string; subtype: string; note: string }>;
  }>;
}

export interface GrabOptions {
  homeDir?: string;
  limit?: number;
  dryRun?: boolean;
  source?: string;
  extractor?: 'local' | 'host';
  provider?: ExtractorProvider; // injectable for tests
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
}

function buildChunkPlaintext(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const role = e.role === 'user' ? 'user' : 'assistant';
      const time = e.timestamp.slice(11, 16);
      return `[${role} ${time}] ${e.text.slice(0, 1000)}`;
    })
    .join('\n');
}

export async function grab(cwd: string, options: GrabOptions = {}): Promise<GrabResult> {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot && !options.dryRun) {
    throw new Error('not initialized: run "handprint init" first');
  }
  if (!isGlobalInitialized() && !options.dryRun) {
    throw new Error('global config not found: run "handprint init --global" first');
  }

  const config = isGlobalInitialized() ? loadGlobalConfig().extraction : undefined;
  const provider =
    options.provider ??
    resolveProvider({
      config,
      homeDir: options.homeDir,
      forceProvider: options.extractor,
      onDownload: options.onDownload,
    });

  const sessions = discoverSessions({
    homeDir: options.homeDir,
    sourceId: options.source,
    sources: config?.sources,
  });
  const toProcess = sessions.slice(0, options.limit ?? sessions.length);

  const result: GrabResult = { handprintsCreated: 0, sessionsScanned: 0, details: [] };

  for (const ref of toProcess) {
    const adapter = adapterById(ref.sourceId);
    if (!adapter) continue;
    result.sessionsScanned++;
    console.error(`scanning ${ref.sourceId}:${ref.project} / ${ref.sessionId.slice(0, 8)}...`);

    const { entries } = adapter.parse(ref);
    if (entries.length === 0) continue;

    const extractions = await extractFromEntries(entries, provider);
    for (const hp of extractions) {
      if (hp.marks.length === 0) continue;

      if (options.dryRun) {
        result.details.push({
          hash: '(dry-run)',
          agent: adapter.descriptor.sourceAgent,
          extractor: provider.label(),
          marks: hp.marks,
        });
        result.handprintsCreated++;
        continue;
      }

      const built = await buildHandprint({
        projectRoot: projectRoot!,
        marks: hp.marks,
        artifacts: hp.artifacts,
        source: {
          agent: adapter.descriptor.sourceAgent,
          extractor: provider.label(),
          session: ref.sessionId,
        },
        plaintext: buildChunkPlaintext(entries),
      });

      result.details.push({
        hash: built.hash,
        agent: adapter.descriptor.sourceAgent,
        extractor: provider.label(),
        marks: built.handprint.marks,
      });
      result.handprintsCreated++;
    }
  }

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/commands/grab.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/commands/grab.ts tests/commands/grab.test.ts
git commit -m "feat(grab): multi-source discovery + provider extraction with split provenance"
```

---

## Task 12: `handprint sources` command + CLI wiring + exports

**Files:**
- Create: `src/commands/sources.ts`
- Modify: `bin/handprint.ts`, `src/index.ts`
- Test: `tests/commands/sources.test.ts`

**Interfaces:**
- Consumes: `ALL_ADAPTERS`, `discoverSessions` from `../sources/index.js`.
- Produces: `listSources(opts?: { homeDir?: string }): Array<{ id; displayName; sourceAgent; implemented; locations; sessions; capabilities }>` — for each adapter, its descriptor plus `sessions` count from `locate()` (0 for stubs).

- [ ] **Step 1: Write the failing test**

```ts
// tests/commands/sources.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSources } from '../../src/commands/sources.js';

describe('listSources', () => {
  it('reports all adapters with implemented flag and session counts', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-src-'));
    const proj = join(home, '.claude', 'projects', '-Users-test-app');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'sess-1.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello there everyone' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }));
    const rows = listSources({ homeDir: home });
    const claude = rows.find((r) => r.id === 'claude-code')!;
    expect(claude.implemented).toBe(true);
    expect(claude.sessions).toBe(1);
    const codex = rows.find((r) => r.id === 'codex')!;
    expect(codex.implemented).toBe(false);
    expect(codex.sessions).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/commands/sources.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create the command module**

```ts
// src/commands/sources.ts
import { ALL_ADAPTERS } from '../sources/index.js';
import type { SourceCapabilities } from '../sources/types.js';

export interface SourceRow {
  id: string;
  displayName: string;
  sourceAgent: string;
  implemented: boolean;
  locations: string[];
  sessions: number;
  capabilities: SourceCapabilities;
}

export function listSources(opts?: { homeDir?: string }): SourceRow[] {
  return ALL_ADAPTERS.map((a) => {
    let sessions = 0;
    if (a.descriptor.implemented) {
      try {
        sessions = a.locate({ homeDir: opts?.homeDir }).length;
      } catch {
        sessions = 0;
      }
    }
    return {
      id: a.descriptor.id,
      displayName: a.descriptor.displayName,
      sourceAgent: a.descriptor.sourceAgent,
      implemented: a.descriptor.implemented,
      locations: a.descriptor.locations,
      sessions,
      capabilities: a.descriptor.capabilities,
    };
  });
}
```

- [ ] **Step 4: Wire the CLI**

In `bin/handprint.ts`, add the import and command, and extend `grab` options:

```ts
import { listSources } from '../src/commands/sources.js';
```

```ts
program
  .command('sources')
  .description('List transcript sources, where they live, and how many sessions are found')
  .action(() => {
    for (const s of listSources()) {
      const status = s.implemented ? `${s.sessions} sessions` : 'not yet supported';
      console.log(`${s.id.padEnd(12)} ${s.displayName.padEnd(14)} ${status}`);
      console.log(`  paths: ${s.locations.join(', ')}`);
      console.log(`  data:  timestamps=${s.capabilities.timestamps} project=${s.capabilities.project} branch=${s.capabilities.gitBranch} model=${s.capabilities.model}`);
    }
  });
```

Update the existing `grab` command definition to add flags and pass them through:

```ts
program
  .command('grab')
  .description('Extract decisions from AI transcripts')
  .option('-n, --limit <n>', 'Sessions to scan', parseInt)
  .option('--source <id>', 'Only scan one source (claude-code, opencode)')
  .option('--extractor <kind>', 'Extractor: local | host')
  .option('--dry-run', 'Show what would be extracted')
  .action(async (opts) => {
    try {
      const result = await grab(process.cwd(), {
        limit: opts.limit,
        dryRun: opts.dryRun,
        source: opts.source,
        extractor: opts.extractor,
      });
      // ...existing printing block unchanged...
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });
```

In `src/index.ts`, add exports:

```ts
export { grab } from './commands/grab.js';
export { listSources } from './commands/sources.js';
export { discoverSessions, ALL_ADAPTERS, adapterById } from './sources/index.js';
export { resolveProvider, extractFromEntries, MODELS, DEFAULT_MODEL_ID } from './extractor/index.js';
```

(Keep the existing `export { grab }` line de-duplicated — there must be exactly one.)

- [ ] **Step 5: Run test + full suite + typecheck**

Run:
```bash
npx vitest run tests/commands/sources.test.ts
pnpm run fix
pnpm run test
```
Expected: new test PASS; typecheck clean; full suite green.

- [ ] **Step 6: Commit**

```bash
git add src/commands/sources.ts bin/handprint.ts src/index.ts tests/commands/sources.test.ts
git commit -m "feat(cli): handprint sources command + grab --source/--extractor flags"
```

---

## Task 13: Delete the Cloudflare scanner + verify no references remain

**Files:**
- Delete: `src/scanner/ai-extractor.ts`, `src/scanner/claude-code.ts`
- Modify: any file still importing from `../scanner/...` (update to `../sources/...` or `../extractor/...`)
- Test: existing `tests/scanner/claude-code.test.ts` → move/replace (covered by `tests/sources/claude-code.test.ts`); delete the old file.

**Interfaces:**
- Consumes: nothing new. This task removes the legacy modules and the Cloudflare dependency for good.

- [ ] **Step 1: Find lingering references**

Run:
```bash
grep -rn "scanner/ai-extractor\|scanner/claude-code\|callWorkersAI\|getCloudflareAuth\|CLOUDFLARE_" src bin tests | grep -v node_modules
```
Expected: only the files being deleted (and the old scanner test). If any other file imports them, update those imports to the new `src/sources` / `src/extractor` modules.

- [ ] **Step 2: Delete legacy modules + old test**

```bash
git rm src/scanner/ai-extractor.ts src/scanner/claude-code.ts tests/scanner/claude-code.test.ts
```

- [ ] **Step 3: Re-run the reference grep to confirm clean**

Run:
```bash
grep -rn "callWorkersAI\|getCloudflareAuth\|CLOUDFLARE_\|scanner/" src bin tests | grep -v node_modules
```
Expected: no output.

- [ ] **Step 4: Full gate**

Run:
```bash
pnpm run fix
pnpm run test
```
Expected: typecheck clean, all tests pass (no missing-module errors).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor: remove Cloudflare Workers AI scanner — no external account required"
```

---

## Task 14: Docs — adapter guide, source roadmap, package AGENTS.md

**Files:**
- Create: `docs/adding-a-source-adapter.md`, `docs/roadmap-sources.md`, `AGENTS.md` (package root)
- Modify: `README.md` (commands table + a "no account required" note)

**Interfaces:** none (documentation).

- [ ] **Step 1: Write `docs/adding-a-source-adapter.md`**

Content must include: the `SourceAdapter` interface verbatim, the `descriptor` capability fields and what each means, a worked minimal example (a JSONL-glob adapter using `src/sources/jsonl-glob.ts` if present, else the claude-code adapter as the reference), how `locate()`/`parse()`/`mtimeMs` are used by `discoverSessions`, and the rule that `descriptor.sourceAgent` is what lands in `handprint.source.agent`.

- [ ] **Step 2: Write `docs/roadmap-sources.md`**

Content: table of sources with status — `claude-code` (shipped), `opencode` (shipped), `codex` (stub: `~/.codex/sessions`, format TBD-from-disk), `cursor` (stub: SQLite under app-support), and roadmap rows for `chatgpt` (data export JSON), `lovable` (web — needs a capture path), and a `generic`/open-integration story. One paragraph each on what's needed to implement.

- [ ] **Step 3: Write package-root `AGENTS.md`**

Content: instruct an agent installing handprint how to configure extraction without prompts:
- choose `handprint config set extraction.provider local` (private, free, no quota) or `host` (uses the user's existing Claude/opencode/codex quota);
- for `local`, pick the lightest appropriate model: list `handprint`'s `MODELS` ids with size/RAM and say "pick the smallest that the machine can run; default `qwen2.5-3b-instruct-q4`";
- `handprint config set extraction.sources '["claude-code","opencode"]'` to scope discovery;
- note: no Cloudflare/account is ever required.

- [ ] **Step 4: Update `README.md`**

Add `handprint sources` to the commands table, add `--source`/`--extractor` to the `grab` row, and add a short "Runs entirely on your machine — no account required" section describing the two extractor options.

- [ ] **Step 5: Commit**

```bash
git add docs/adding-a-source-adapter.md docs/roadmap-sources.md AGENTS.md README.md
git commit -m "docs: adapter guide, source roadmap, agent install config, README updates"
```

---

## Task 15: End-to-end smoke + open PR

**Files:** none (verification + PR).

- [ ] **Step 1: Dry-run against real local data (Claude + opencode)**

Run:
```bash
npm run build
node dist/bin/handprint.js sources
node dist/bin/handprint.js grab --dry-run --extractor host -n 1
```
Expected: `sources` lists claude-code + opencode with real session counts and the two stubs as "not yet supported". `grab --dry-run --extractor host` runs through a detected CLI (if one is on PATH) without writing objects. (If no agent CLI is present, expect the clear "no agent CLI found" error — that is correct behavior.)

- [ ] **Step 2: Full gate one more time**

Run:
```bash
pnpm run fix
pnpm run test
```
Expected: clean + green.

- [ ] **Step 3: Push and open the PR**

```bash
git push -u origin whiteside/multi-source-local-inference
gh pr create --title "Multi-source transcript discovery + local inference (no account required)" --body "$(cat <<'EOF'
## Summary
Refactors how conversation transcripts are found and parsed.

- **Discovery/parsing**: pluggable source adapters. Implements claude-code + opencode; scaffolds codex + cursor.
- **Inference**: removes the Cloudflare Workers AI dependency. Adds a local-model provider (node-llama-cpp, GBNF-constrained JSON) and a host-agent provider (claude/opencode/codex CLI). No external account ever required.
- **Provenance**: `source.agent` (which transcript) is now distinct from `source.extractor` (which model produced the marks).
- New `handprint sources` command; `grab --source/--extractor` flags.

See `docs/superpowers/specs/2026-06-27-multi-source-local-inference-design.md`.
EOF
)"
```
Expected: PR opened on `CameronWhiteside/handprint`.

---

## Self-Review

**Spec coverage:**
- No-Cloudflare / no-account → Tasks 8–11, 13 (provider abstraction; delete Cloudflare). ✓
- Multi-source discovery + parsing (claude+opencode impl, codex+cursor stub) → Tasks 2–5. ✓
- Honest provenance (source.agent vs source.extractor) → Tasks 1 reused existing schema, 11 sets both. ✓
- Explicit config of paths/timestamps/metadata → `descriptor.locations` + `capabilities`, surfaced by `handprint sources` (Task 12). ✓
- Local model (node-llama-cpp, GBNF, registry, consent download) → Tasks 7–8. ✓
- Host-agent (claude/opencode/codex) → Task 9. ✓
- User/agent choice + AGENTS.md + model registry with descriptions → Tasks 1 (config), 12 (config keys), 14 (AGENTS.md), 7 (registry). ✓
- `handprint sources`, `grab` flags, config keys → Task 12. ✓
- Adapter guide + roadmap docs → Task 14. ✓
- Tests against real on-disk samples + dry-run → Tasks 3–5, 11, 15. ✓

**Placeholder scan:** No "TBD/implement later" in code steps; stub adapters intentionally throw `NotImplementedError` (a real, tested behavior, not a placeholder). ✓

**Type consistency:** `SessionRef`, `NormalizedSession`, `SourceAdapter`, `ExtractorProvider`, `RawExtraction`, `ExtractionConfig` names are used identically across tasks. `provider.label()` → `source.extractor`; `descriptor.sourceAgent` → `source.agent`. `discoverSessions` option `sourceId` (single) vs `sources` (allow-list) used consistently in Tasks 5, 11, 12. ✓

**Known follow-ups (out of scope, documented):** real codex/cursor parsing; verifying installed `node-llama-cpp` v3 grammar API against the snippet in Task 8.
