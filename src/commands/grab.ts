// src/commands/grab.ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { discoverSessions, adapterById } from '../sources/index.js';
import { resolveProvider, extractFromEntries } from '../extractor/index.js';
import { buildConversationWindow, chunkEntries } from '../extractor/window.js';
import type { ExtractorProvider } from '../extractor/types.js';
import type { TranscriptEntry } from '../sources/types.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot, projectDir } from '../dirs/project.js';
import { isGlobalInitialized, loadGlobalConfig } from '../dirs/global.js';
import { readObject } from '../store/objects.js';
import { loadGrabIndex, saveGrabIndex } from '../store/grabIndex.js';
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
  skippedAlreadyGrabbed: number;
  skippedUnchanged: number;
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
  details: Array<{ hash: string; agent: string; extractor: string; marks: Array<{ type: string; subtype: string; note: string }> }>;
}

export interface GrabOptions {
  homeDir?: string;
  limit?: number;
  dryRun?: boolean;
  source?: string;
  project?: string[];
  since?: string;
  until?: string;
  days?: number;
  minMessages?: number;
  /** Re-grab whole sessions, ignoring the incremental watermark. */
  redo?: boolean;
  extractor?: 'local' | 'host';
  yes?: boolean;
  confirm?: (plan: GrabPlan) => Promise<GrabDecision>;
  provider?: ExtractorProvider;
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
  log?: (line: string) => void;
  now?: number;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

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

/** Sessions already in the chain but predating the incremental index (legacy). */
function legacyGrabbedSessionIds(projectRoot: string): Set<string> {
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

/** Latest ISO timestamp across entries (the watermark for incremental grabs). */
function maxTs(entries: TranscriptEntry[]): string {
  let m = '';
  for (const e of entries) if (e.timestamp && e.timestamp > m) m = e.timestamp;
  return m;
}

/** Entries newer than the watermark (or all of them if no watermark). */
function newerThan(entries: TranscriptEntry[], lastTs: string | undefined): TranscriptEntry[] {
  if (!lastTs) return entries;
  return entries.filter((e) => e.timestamp && e.timestamp > lastTs);
}

function fmtDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms <= 0) return '0s';
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return rs ? `${m}m ${rs}s` : `${m}m`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return rm ? `${h}h ${rm}m` : `${h}h`;
}

interface Scanned {
  sourceId: string;
  sessionId: string;
  project: string;
  messages: number; // count of NEW messages to process
  chunks: number;
  lastTs: string | undefined; // watermark to filter by on process
}

export async function grab(cwd: string, options: GrabOptions = {}): Promise<GrabResult> {
  const log = options.log ?? ((l: string) => console.error(l));
  const now = options.now ?? Date.now();
  const start = now;

  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot && !options.dryRun) throw new Error('not initialized: run "handprint init" first');
  if (!isGlobalInitialized() && !options.dryRun) throw new Error('global config not found: run "handprint init --global" first');

  const config = isGlobalInitialized() ? loadGlobalConfig().extraction : undefined;
  const provider =
    options.provider ??
    resolveProvider({ config, homeDir: options.homeDir, forceProvider: options.extractor, onDownload: options.onDownload });
  const extractor = provider.label();

  let sessions = discoverSessions({ homeDir: options.homeDir, sourceId: options.source, sources: config?.sources });

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

  if (options.project && options.project.length > 0) {
    const needles = options.project.map((p) => p.toLowerCase());
    sessions = sessions.filter((s) => needles.some((n) => s.project.toLowerCase().includes(n)));
  }

  const index = projectRoot ? loadGrabIndex(projectRoot) : { version: 1 as const, sessions: {} };
  const legacy = !options.redo && projectRoot ? legacyGrabbedSessionIds(projectRoot) : new Set<string>();

  sessions = sessions.slice(0, options.limit ?? sessions.length);

  const minMessages = options.minMessages ?? 0;
  const scanned: Scanned[] = [];
  let skippedAlreadyGrabbed = 0;
  let skippedUnchanged = 0;
  let skippedTooSmall = 0;

  for (const ref of sessions) {
    const adapter = adapterById(ref.sourceId);
    if (!adapter) continue;
    const { entries } = adapter.parse(ref);

    const indexed = options.redo ? undefined : index.sessions[ref.sessionId]?.lastTs;
    if (indexed === undefined && !options.redo && legacy.has(ref.sessionId)) {
      skippedAlreadyGrabbed++; // grabbed before the incremental index existed
      continue;
    }
    const fresh = newerThan(entries, indexed);
    if (indexed !== undefined && fresh.length === 0) {
      skippedUnchanged++; // session has no new activity since last grab
      continue;
    }
    if (fresh.length < minMessages) {
      skippedTooSmall++;
      continue;
    }
    scanned.push({
      sourceId: ref.sourceId,
      sessionId: ref.sessionId,
      project: ref.project,
      messages: fresh.length,
      chunks: fresh.length === 0 ? 0 : chunkEntries(fresh).length,
      lastTs: indexed,
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
    skippedUnchanged,
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
  const totalChunks = toProcess.reduce((n, s) => n + s.chunks, 0);

  // ── Process with rich, always-on progress + ETA ───────────
  log(
    `Processing ${toProcess.length} session(s), ~${totalChunks} model call(s) with ${extractor}.\n` +
      `Progress is saved per session. If this is slow, press Ctrl-C (finished sessions are kept) and narrow with --days N, --project NAME, or -n N.`,
  );

  const t0 = Date.now();
  let chunksDone = 0;
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
    const fresh = newerThan(entries, s.lastTs);
    messagesProcessed += fresh.length;

    log(
      `[${i + 1}/${toProcess.length}] ${s.project} · ${s.sessionId.slice(0, 8)} · ${fresh.length} new msg${fresh.length === 1 ? '' : 's'}` +
        `${s.chunks > 1 ? ` · ${s.chunks} chunks` : ''}`,
    );

    if (fresh.length > 0) {
      const extractions = await extractFromEntries(fresh, provider, {
        onChunkDone: () => {
          chunksDone++;
          const elapsed = Date.now() - t0;
          const avg = elapsed / chunksDone;
          const remaining = Math.max(0, totalChunks - chunksDone);
          const pct = totalChunks > 0 ? Math.round((chunksDone / totalChunks) * 100) : 100;
          log(`    ${chunksDone}/${totalChunks} chunks · ${pct}% · ~${fmtDuration(avg * remaining)} left`);
        },
      });
      for (const hp of extractions) {
        if (hp.marks.length === 0) continue;
        const built = await buildHandprint({
          projectRoot: projectRoot!,
          marks: hp.marks,
          artifacts: hp.artifacts,
          source: { agent: adapter.descriptor.sourceAgent, extractor, session: s.sessionId },
          plaintext: hp.sourcePlaintext ?? buildConversationWindow(fresh),
        });
        details.push({ hash: built.hash, agent: adapter.descriptor.sourceAgent, extractor, marks: built.handprint.marks });
        handprintsCreated++;
      }
    }

    // Advance the watermark past everything seen, and persist now so an
    // interrupted run keeps finished sessions done.
    if (projectRoot) {
      index.sessions[s.sessionId] = { lastTs: maxTs(entries) || s.lastTs || '', mtimeMs: full.mtimeMs, grabbedAt: new Date(now).toISOString() };
      saveGrabIndex(projectRoot, index);
    }
  }

  log(`Done in ${fmtDuration(Date.now() - t0)}.`);

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
