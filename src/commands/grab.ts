// src/commands/grab.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverSessions, adapterById } from '../sources/index.js';
import { resolveProvider, extractFromEntries } from '../extractor/index.js';
import { buildConversationWindow, chunkEntries } from '../extractor/window.js';
import type { ExtractorProvider } from '../extractor/types.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot, projectDir } from '../dirs/project.js';
import { isGlobalInitialized, loadGlobalConfig } from '../dirs/global.js';
import { readObject } from '../store/objects.js';
import type { ModelEntry } from '../extractor/models.js';

interface PlanProject {
  project: string;
  sessions: number;
  messages: number;
  chunks: number;
}

export interface GrabPlan {
  projects: PlanProject[];
  totalSessions: number;
  totalMessages: number;
  totalChunks: number;
  extractor: string;
  /** Filtered-out counts, for transparency in the UI. */
  skippedAlreadyGrabbed: number;
  skippedTooSmall: number;
  skippedOutOfRange: number;
}

export type GrabDecision = { proceed: false } | { proceed: true; projects?: string[] };

export interface GrabResult {
  plan: GrabPlan;
  confirmed: boolean;
  needsConfirm: boolean;
  dryRun: boolean;
  handprintsCreated: number;
  sessionsProcessed: number;
  messagesProcessed: number;
  elapsedMs: number;
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
  project?: string[];
  /** Only sessions last active on/after this (ISO date or relative like 7d, 24h). */
  since?: string;
  /** Only sessions last active on/before this (ISO date or relative). */
  until?: string;
  /** Shorthand for since = now - days. */
  days?: number;
  /** Skip sessions with fewer than this many messages. */
  minMessages?: number;
  /** Re-grab sessions already in the local chain (default: skip them). */
  redo?: boolean;
  extractor?: 'local' | 'host';
  yes?: boolean;
  confirm?: (plan: GrabPlan) => Promise<GrabDecision>;
  provider?: ExtractorProvider;
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
  log?: (line: string) => void;
  /** Injectable clock for testability. */
  now?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

/** Parse a date bound: ISO date, or relative `<n>d` / `<n>h` / `<n>m` (ago). */
function parseWhen(s: string, now: number): number {
  const rel = s.trim().match(/^(\d+)\s*([dhm])$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const ms = unit === 'd' ? 86400000 : unit === 'h' ? 3600000 : 60000;
    return now - n * ms;
  }
  const t = Date.parse(s);
  if (Number.isNaN(t)) throw new Error(`invalid date: "${s}" (use ISO like 2026-06-01 or relative like 7d)`);
  return t;
}

/** Session ids already extracted into this project's chain (for idempotency). */
function grabbedSessionIds(projectRoot: string): Set<string> {
  const set = new Set<string>();
  const hpDir = projectDir(projectRoot);
  const logPath = join(hpDir, 'log');
  if (!existsSync(logPath)) return set;
  for (const hash of readFileSync(logPath, 'utf-8').split('\n').filter(Boolean)) {
    const obj = readObject(hpDir, hash);
    if (!isRecord(obj)) continue;
    const source = obj.source;
    if (isRecord(source) && typeof source.session === 'string') set.add(source.session);
  }
  return set;
}

interface Scanned {
  sourceId: string;
  sessionId: string;
  project: string;
  messages: number;
  chunks: number;
}

export async function grab(cwd: string, options: GrabOptions = {}): Promise<GrabResult> {
  const log = options.log ?? ((l: string) => console.error(l));
  const now = options.now ?? Date.now();
  const start = now;

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
  const extractor = provider.label();

  // ── Discovery ─────────────────────────────────────────────
  let sessions = discoverSessions({
    homeDir: options.homeDir,
    sourceId: options.source,
    sources: config?.sources,
  });

  // ── Time window (by session last-activity / file mtime) ───
  const sinceMs = options.days != null ? now - options.days * 86400000 : options.since ? parseWhen(options.since, now) : undefined;
  const untilMs = options.until ? parseWhen(options.until, now) : undefined;
  let skippedOutOfRange = 0;
  if (sinceMs != null || untilMs != null) {
    sessions = sessions.filter((s) => {
      const ok = (sinceMs == null || s.mtimeMs >= sinceMs) && (untilMs == null || s.mtimeMs <= untilMs);
      if (!ok) skippedOutOfRange++;
      return ok;
    });
  }

  // ── Project targeting ─────────────────────────────────────
  if (options.project && options.project.length > 0) {
    const needles = options.project.map((p) => p.toLowerCase());
    sessions = sessions.filter((s) => needles.some((n) => s.project.toLowerCase().includes(n)));
  }

  // ── Idempotency: drop already-grabbed sessions ────────────
  let skippedAlreadyGrabbed = 0;
  if (!options.redo && projectRoot) {
    const done = grabbedSessionIds(projectRoot);
    if (done.size > 0) {
      sessions = sessions.filter((s) => {
        const seen = done.has(s.sessionId);
        if (seen) skippedAlreadyGrabbed++;
        return !seen;
      });
    }
  }

  sessions = sessions.slice(0, options.limit ?? sessions.length);

  // ── Scan (no model): counts + min-messages filter ─────────
  const minMessages = options.minMessages ?? 0;
  const scanned: Scanned[] = [];
  let skippedTooSmall = 0;
  for (const ref of sessions) {
    const adapter = adapterById(ref.sourceId);
    if (!adapter) continue;
    const { entries } = adapter.parse(ref);
    if (entries.length < minMessages) {
      skippedTooSmall++;
      continue;
    }
    scanned.push({
      sourceId: ref.sourceId,
      sessionId: ref.sessionId,
      project: ref.project,
      messages: entries.length,
      chunks: entries.length === 0 ? 0 : chunkEntries(entries).length,
    });
  }

  const byProject = new Map<string, PlanProject>();
  for (const s of scanned) {
    const p = byProject.get(s.project) ?? { project: s.project, sessions: 0, messages: 0, chunks: 0 };
    p.sessions += 1;
    p.messages += s.messages;
    p.chunks += s.chunks;
    byProject.set(s.project, p);
  }
  const plan: GrabPlan = {
    projects: [...byProject.values()].sort((a, b) => b.chunks - a.chunks),
    totalSessions: scanned.length,
    totalMessages: scanned.reduce((n, s) => n + s.messages, 0),
    totalChunks: scanned.reduce((n, s) => n + s.chunks, 0),
    extractor,
    skippedAlreadyGrabbed,
    skippedTooSmall,
    skippedOutOfRange,
  };

  const base: GrabResult = {
    plan,
    confirmed: false,
    needsConfirm: false,
    dryRun: Boolean(options.dryRun),
    handprintsCreated: 0,
    sessionsProcessed: 0,
    messagesProcessed: 0,
    elapsedMs: Date.now() - start,
    details: [],
  };

  if (scanned.length === 0) return base;
  if (options.dryRun) return base;

  // ── Decide what to process ────────────────────────────────
  let allowed: Set<string> | null = null;
  if (options.yes) {
    allowed = null;
  } else if (options.confirm) {
    const decision = await options.confirm(plan);
    if (!decision.proceed) return base;
    allowed = decision.projects ? new Set(decision.projects) : null;
  } else {
    return { ...base, needsConfirm: true };
  }

  const toProcess = scanned.filter((s) => allowed === null || allowed.has(s.project));

  // ── Process ───────────────────────────────────────────────
  let handprintsCreated = 0;
  let messagesProcessed = 0;
  const details: GrabResult['details'] = [];
  for (let i = 0; i < toProcess.length; i++) {
    const s = toProcess[i];
    const adapter = adapterById(s.sourceId);
    if (!adapter) continue;
    const full = sessions.find((x) => x.sessionId === s.sessionId && x.sourceId === s.sourceId);
    if (!full) continue;
    const { entries } = adapter.parse(full);
    messagesProcessed += entries.length;

    log(
      `[${i + 1}/${toProcess.length}] ${s.sourceId} ${s.project} · ${s.sessionId.slice(0, 8)} · ` +
        `${entries.length} msg${entries.length === 1 ? '' : 's'}${s.chunks > 1 ? ` · ${s.chunks} chunks` : ''}`,
    );
    if (entries.length === 0) continue;

    const extractions = await extractFromEntries(entries, provider, {
      onChunk: (n, total) => {
        if (total > 1) log(`  chunk ${n}/${total}...`);
      },
    });
    for (const hp of extractions) {
      if (hp.marks.length === 0) continue;
      const built = await buildHandprint({
        projectRoot: projectRoot!,
        marks: hp.marks,
        artifacts: hp.artifacts,
        source: { agent: adapter.descriptor.sourceAgent, extractor, session: s.sessionId },
        plaintext: hp.sourcePlaintext ?? buildConversationWindow(entries),
      });
      details.push({ hash: built.hash, agent: adapter.descriptor.sourceAgent, extractor, marks: built.handprint.marks });
      handprintsCreated++;
    }
  }

  return {
    ...base,
    confirmed: true,
    handprintsCreated,
    sessionsProcessed: toProcess.length,
    messagesProcessed,
    elapsedMs: Date.now() - start,
    details,
  };
}
