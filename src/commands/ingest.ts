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
import { enrichAnchors } from "../profile/anchors.js";
import { loadConfig } from "./config.js";
import { sanitize } from "../sanitizer/sanitize.js";

const TYPE_MAP: Record<string, HandprintType> = {
  vision: HandprintType.Vision,
  choice: HandprintType.Choice,
  method: HandprintType.Method,
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

    // Derive git context from the session's transcript entries
    const sessionCwd = entries[0]?.cwd || repoRoot;
    const sessionBranch = entries[0]?.gitBranch || undefined;

    // Load anchor config (best-effort, fallback to defaults)
    let anchorConfig = {
      commitWindowBefore: "PT30M",
      commitWindowAfter: "PT60M",
      linkPRs: true,
      linkRepo: true,
    };
    try {
      const cfg = loadConfig(repoRoot);
      anchorConfig = cfg.protocol.anchors;
    } catch {
      /* use defaults */
    }

    for (const hp of extraction.handprints) {
      if (options?.dryRun) {
        result.sealed.push({ hash: "(dry-run)", handprint: hp });
        continue;
      }

      const type = TYPE_MAP[hp.type];
      if (!type) continue;

      const anchors = enrichAnchors(
        {
          cwd: sessionCwd,
          timestamp: hp.timestamp,
          gitBranch: sessionBranch,
        },
        anchorConfig,
      );

      const hash = sealHandprint(repoRoot, {
        type,
        intent: sanitize(hp.intent),
        risk: sanitize(hp.risk),
        context: sanitize(hp.context),
        horizon: hp.horizon ?? undefined,
        confidence: hp.confidence,
        source: hp.source || "claude-code",
        anchors,
      });
      result.sealed.push({ hash, handprint: hp });
    }
  }

  return result;
}
