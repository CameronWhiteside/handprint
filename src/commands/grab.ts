// src/commands/grab.ts
import { discoverSessions, adapterById } from '../sources/index.js';
import { resolveProvider, extractFromEntries } from '../extractor/index.js';
import { buildConversationWindow, chunkEntries } from '../extractor/window.js';
import type { ExtractorProvider } from '../extractor/types.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot } from '../dirs/project.js';
import { isGlobalInitialized, loadGlobalConfig } from '../dirs/global.js';
import type { ModelEntry } from '../extractor/models.js';

/** One project's scope in the scan, shown before processing. */
interface PlanProject {
  project: string;
  sessions: number;
  messages: number;
  chunks: number;
}

/** The scan result shown to the human/agent before anything is processed. */
export interface GrabPlan {
  projects: PlanProject[];
  totalSessions: number;
  totalMessages: number;
  totalChunks: number;
  extractor: string;
}

/** Decision returned by a confirm handler. `projects` undefined = all. */
export type GrabDecision = { proceed: false } | { proceed: true; projects?: string[] };

export interface GrabResult {
  plan: GrabPlan;
  /** Did extraction actually run? (false for dry run, declined confirm, or no TTY). */
  confirmed: boolean;
  /** True when processing was skipped because no confirmation was available. */
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
  /** Only sessions whose project path contains one of these substrings (case-insensitive). */
  project?: string[];
  extractor?: 'local' | 'host';
  /** Skip the confirm step and process everything (for agents / scripts). */
  yes?: boolean;
  /** Interactive confirm. Receives the plan, returns whether/what to process. */
  confirm?: (plan: GrabPlan) => Promise<GrabDecision>;
  provider?: ExtractorProvider; // injectable for tests
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
  /** Progress sink (defaults to stderr). */
  log?: (line: string) => void;
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
  const start = Date.now();

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

  // ── Discovery + project targeting ─────────────────────────
  let sessions = discoverSessions({
    homeDir: options.homeDir,
    sourceId: options.source,
    sources: config?.sources,
  });
  if (options.project && options.project.length > 0) {
    const needles = options.project.map((p) => p.toLowerCase());
    sessions = sessions.filter((s) => needles.some((n) => s.project.toLowerCase().includes(n)));
  }
  sessions = sessions.slice(0, options.limit ?? sessions.length);

  // ── Scan (no model): count messages + chunks per session ──
  const scanned: Scanned[] = [];
  for (const ref of sessions) {
    const adapter = adapterById(ref.sourceId);
    if (!adapter) continue;
    const { entries } = adapter.parse(ref);
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
  if (options.dryRun) return base; // dry run = scan only

  // ── Decide what to process (confirm / --yes / safe stop) ──
  let allowed: Set<string> | null = null; // null = all projects
  if (options.yes) {
    allowed = null;
  } else if (options.confirm) {
    const decision = await options.confirm(plan);
    if (!decision.proceed) return base;
    allowed = decision.projects ? new Set(decision.projects) : null;
  } else {
    // No confirmation available (e.g. non-interactive) and no --yes: stop safely.
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
    const ref = { sourceId: s.sourceId, sessionId: s.sessionId, project: s.project, locator: '', mtimeMs: 0 };
    // Re-resolve the full ref from discovery (locator needed to parse).
    const full = sessions.find((x) => x.sessionId === s.sessionId && x.sourceId === s.sourceId) ?? ref;
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
