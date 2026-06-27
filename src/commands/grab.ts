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
