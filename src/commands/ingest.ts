import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  discoverTranscripts,
  loadTranscriptEntries,
  extractHandprintsFromTranscript,
  type ExtractedHandprint,
} from "../scanner/ai-extractor.js";
import { sealHandprint } from "./seal.js";
import { HANDPRINT_DIR } from "./init.js";
import { HandprintType } from "../model/handprint.js";

const TYPE_MAP: Record<string, HandprintType> = {
  direction: HandprintType.Direction,
  override: HandprintType.Override,
  rejection: HandprintType.Rejection,
  constraint: HandprintType.Constraint,
  wager: HandprintType.Wager,
};

export interface IngestResult {
  sealed: Array<{ hash: string; handprint: ExtractedHandprint }>;
  sessionsScanned: number;
  messagesAnalyzed: number;
}

export async function ingest(
  repoRoot: string,
  options?: {
    claudeDir?: string;
    limit?: number;
    dryRun?: boolean;
  },
): Promise<IngestResult> {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  if (!existsSync(hpDir) && !options?.dryRun) {
    throw new Error("not initialized: run 'handprint init' first");
  }

  const transcripts = discoverTranscripts(options?.claudeDir);
  const limit = options?.limit ?? transcripts.length;
  const toProcess = transcripts.slice(-limit);

  const result: IngestResult = {
    sealed: [],
    sessionsScanned: 0,
    messagesAnalyzed: 0,
  };

  for (const transcript of toProcess) {
    result.sessionsScanned++;
    console.error(
      `scanning ${transcript.project} / ${transcript.sessionId.slice(0, 8)}...`,
    );

    const entries = loadTranscriptEntries(transcript.path);
    if (entries.length === 0) continue;

    const extraction = await extractHandprintsFromTranscript(
      entries,
      transcript.sessionId,
      transcript.project,
    );
    result.messagesAnalyzed += extraction.messagesAnalyzed;

    for (const hp of extraction.handprints) {
      if (options?.dryRun) {
        result.sealed.push({ hash: "(dry-run)", handprint: hp });
        continue;
      }

      const type = TYPE_MAP[hp.type];
      if (!type) continue;

      const hash = sealHandprint(repoRoot, {
        type,
        intent: hp.intent,
        risk: hp.risk,
        context: hp.context,
        horizon: hp.horizon ?? undefined,
        confidence: hp.confidence,
        source: hp.source || "claude-code",
      });
      result.sealed.push({ hash, handprint: hp });
    }
  }

  return result;
}
