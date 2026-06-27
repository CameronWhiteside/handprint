import {
  discoverTranscripts,
  loadTranscriptEntries,
  extractHandprintsFromTranscript,
} from '../scanner/ai-extractor.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot, isProjectInitialized } from '../dirs/project.js';
import { isGlobalInitialized } from '../dirs/global.js';
import type { TranscriptEntry } from '../scanner/claude-code.js';

export interface GrabResult {
  handprintsCreated: number;
  sessionsScanned: number;
  details: Array<{
    hash: string;
    marks: Array<{ type: string; subtype: string; note: string }>;
  }>;
}

function chunkByTimeGap(
  entries: TranscriptEntry[],
  gapMs: number = 5 * 60 * 1000,
): TranscriptEntry[][] {
  if (entries.length === 0) return [];

  const chunks: TranscriptEntry[][] = [];
  let current: TranscriptEntry[] = [entries[0]];

  for (let i = 1; i < entries.length; i++) {
    const prevTs = new Date(entries[i - 1].timestamp).getTime();
    const currTs = new Date(entries[i].timestamp).getTime();

    if (currTs - prevTs > gapMs || isNaN(prevTs) || isNaN(currTs)) {
      chunks.push(current);
      current = [entries[i]];
    } else {
      current.push(entries[i]);
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function buildChunkPlaintext(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const role = e.role === 'user' ? 'user' : 'assistant';
      const time = e.timestamp.slice(11, 16);
      const text = e.text.slice(0, 1000);
      return `[${role} ${time}] ${text}`;
    })
    .join('\n');
}

export async function grab(
  cwd: string,
  options?: {
    claudeDir?: string;
    limit?: number;
    dryRun?: boolean;
  },
): Promise<GrabResult> {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot && !options?.dryRun) {
    throw new Error('not initialized: run "handprint init" first');
  }
  if (!isGlobalInitialized() && !options?.dryRun) {
    throw new Error('global config not found: run "handprint init --global" first');
  }

  const transcripts = discoverTranscripts(options?.claudeDir);
  const limit = options?.limit ?? transcripts.length;
  const toProcess = transcripts.slice(0, limit);

  const result: GrabResult = {
    handprintsCreated: 0,
    sessionsScanned: 0,
    details: [],
  };

  for (const transcript of toProcess) {
    result.sessionsScanned++;
    console.error(
      `scanning ${transcript.project} / ${transcript.sessionId.slice(0, 8)}...`,
    );

    const entries = loadTranscriptEntries(transcript.path);
    if (entries.length === 0) continue;

    const chunks = chunkByTimeGap(entries);

    for (const chunk of chunks) {
      const plaintext = buildChunkPlaintext(chunk);
      if (!plaintext.trim()) continue;

      const extraction = await extractHandprintsFromTranscript(
        chunk,
        transcript.sessionId,
        transcript.project,
      );

      for (const hp of extraction.handprints) {
        if (hp.marks.length === 0) continue;

        if (options?.dryRun) {
          result.details.push({
            hash: '(dry-run)',
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
            agent: 'claude-code',
            session: transcript.sessionId,
          },
          plaintext,
        });

        result.details.push({
          hash: built.hash,
          marks: built.handprint.marks,
        });
        result.handprintsCreated++;
      }
    }
  }

  return result;
}
