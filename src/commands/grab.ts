// src/commands/grab.ts
import { discoverSessions, adapterById } from '../sources/index.js';
import { resolveProvider, extractFromEntries } from '../extractor/index.js';
import { buildConversationWindow, chunkEntries } from '../extractor/window.js';
import type { ExtractorProvider } from '../extractor/types.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot } from '../dirs/project.js';
import { isGlobalInitialized, loadGlobalConfig } from '../dirs/global.js';
import type { ModelEntry } from '../extractor/models.js';

export interface GrabResult {
  handprintsCreated: number;
  sessionsScanned: number;
  messagesScanned: number;
  projectsScanned: number;
  extractor: string;
  dryRun: boolean;
  elapsedMs: number;
  details: Array<{
    hash: string;
    agent: string;
    extractor: string;
    marks: Array<{ type: string; subtype: string; note: string }>;
  }>;
  /** Per-session scope, populated on a dry run (quick scan). */
  preview: Array<{ sourceId: string; project: string; sessionId: string; messages: number; chunks: number }>;
}

export interface GrabOptions {
  homeDir?: string;
  limit?: number;
  dryRun?: boolean;
  source?: string;
  extractor?: 'local' | 'host';
  provider?: ExtractorProvider; // injectable for tests
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
  /** Progress sink (defaults to stderr). */
  log?: (line: string) => void;
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

  const sessions = discoverSessions({
    homeDir: options.homeDir,
    sourceId: options.source,
    sources: config?.sources,
  });
  const toProcess = sessions.slice(0, options.limit ?? sessions.length);
  const projects = new Set(toProcess.map((r) => r.project));

  const result: GrabResult = {
    handprintsCreated: 0,
    sessionsScanned: 0,
    messagesScanned: 0,
    projectsScanned: projects.size,
    extractor,
    dryRun: Boolean(options.dryRun),
    elapsedMs: 0,
    details: [],
    preview: [],
  };

  // ── Pre-scan summary ──────────────────────────────────────
  log(
    `${toProcess.length} session${toProcess.length === 1 ? '' : 's'} across ${projects.size} project${projects.size === 1 ? '' : 's'}` +
      (options.limit ? ` (limited to ${options.limit})` : '') +
      ` · extractor: ${extractor}`,
  );
  if (options.dryRun) {
    log('dry run: discovery only, no model calls, nothing saved.');
  } else if (provider.id === 'local-model') {
    log('local model: downloads a ~2GB model on first run. Use --extractor host to use your installed Claude/opencode instead.');
  }
  if (toProcess.length === 0) {
    log('no sessions found. Check `handprint sources`.');
    result.elapsedMs = Date.now() - start;
    return result;
  }

  for (let i = 0; i < toProcess.length; i++) {
    const ref = toProcess[i];
    const adapter = adapterById(ref.sourceId);
    if (!adapter) continue;

    const { entries } = adapter.parse(ref);
    const messages = entries.length;
    const chunks = messages === 0 ? 0 : chunkEntries(entries).length;
    result.sessionsScanned++;
    result.messagesScanned += messages;

    log(
      `[${i + 1}/${toProcess.length}] ${ref.sourceId} ${ref.project} · ${ref.sessionId.slice(0, 8)} · ` +
        `${messages} msg${messages === 1 ? '' : 's'}${chunks > 1 ? ` · ${chunks} chunks` : ''}`,
    );

    if (messages === 0) continue;

    // Dry run is a quick scan: report scope, never call the model.
    if (options.dryRun) {
      result.preview.push({ sourceId: ref.sourceId, project: ref.project, sessionId: ref.sessionId, messages, chunks });
      continue;
    }

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
        source: {
          agent: adapter.descriptor.sourceAgent,
          extractor,
          session: ref.sessionId,
        },
        plaintext: hp.sourcePlaintext ?? buildConversationWindow(entries),
      });
      result.details.push({
        hash: built.hash,
        agent: adapter.descriptor.sourceAgent,
        extractor,
        marks: built.handprint.marks,
      });
      result.handprintsCreated++;
    }
  }

  result.elapsedMs = Date.now() - start;
  return result;
}
