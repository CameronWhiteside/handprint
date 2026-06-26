import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  discoverTranscripts,
  loadTranscriptEntries,
  extractHandprintsFromTranscript,
  type ExtractedHandprint,
} from "../scanner/ai-extractor.js";
import { sealChunk } from "./seal.js";
import { HANDPRINT_DIR } from "./init.js";
import { writeMeta } from "../store/meta.js";
import type { DecisionMeta } from "../model/meta.js";
import type { TranscriptEntry } from "../scanner/claude-code.js";
import { enrichAnchors } from "../profile/anchors.js";
import { loadConfig } from "./config.js";

export interface GrabResult {
  sealsCreated: number;
  decisionsExtracted: number;
  sessionsScanned: number;
  details: Array<{
    sealHash: string;
    decisions: ExtractedHandprint[];
  }>;
}

/**
 * Groups transcript entries into conversation chunks based on time gaps.
 * A gap > 5 minutes starts a new chunk.
 */
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

/**
 * Builds plaintext from conversation entries for sealing.
 */
function buildChunkPlaintext(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const role = e.role === "user" ? "user" : "assistant";
      const time = e.timestamp.slice(11, 16); // HH:MM
      const text = e.text.slice(0, 1000);
      return `[${role} ${time}] ${text}`;
    })
    .join("\n");
}

/**
 * Discovers transcripts, seals conversation chunks, extracts decisions
 * as meta entries referencing the seal hashes.
 */
export async function grab(
  repoRoot: string,
  options?: {
    claudeDir?: string;
    limit?: number;
    dryRun?: boolean;
  },
): Promise<GrabResult> {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  if (!existsSync(hpDir) && !options?.dryRun) {
    throw new Error("not initialized: run 'handprint init' first");
  }

  const transcripts = discoverTranscripts(options?.claudeDir);
  const limit = options?.limit ?? transcripts.length;
  const toProcess = transcripts.slice(0, limit);

  const result: GrabResult = {
    sealsCreated: 0,
    decisionsExtracted: 0,
    sessionsScanned: 0,
    details: [],
  };

  // Load anchor config (best-effort)
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

  for (const transcript of toProcess) {
    result.sessionsScanned++;
    console.error(
      `scanning ${transcript.project} / ${transcript.sessionId.slice(0, 8)}...`,
    );

    const entries = loadTranscriptEntries(transcript.path);
    if (entries.length === 0) continue;

    // Group entries into chunks by time gaps
    const chunks = chunkByTimeGap(entries);

    for (const chunk of chunks) {
      const plaintext = buildChunkPlaintext(chunk);
      if (!plaintext.trim()) continue;

      const firstEntry = chunk[0];
      const ts = firstEntry.timestamp || new Date().toISOString();
      const author = "unknown"; // git identity is set at init time
      const sessionCwd = firstEntry.cwd || repoRoot;

      // Seal the chunk
      let sealHash: string;
      if (options?.dryRun) {
        sealHash = "(dry-run)";
      } else {
        sealHash = sealChunk(repoRoot, {
          ts,
          session: transcript.sessionId,
          project: transcript.project,
          author,
          plaintext,
        });
      }
      result.sealsCreated++;

      // Extract decisions from the chunk
      const extraction = await extractHandprintsFromTranscript(
        chunk,
        transcript.sessionId,
        transcript.project,
      );

      const chunkDecisions: ExtractedHandprint[] = [];

      for (const hp of extraction.handprints) {
        if (options?.dryRun) {
          chunkDecisions.push(hp);
          result.decisionsExtracted++;
          continue;
        }

        // Enrich anchors
        const anchors = enrichAnchors(
          {
            cwd: sessionCwd,
            timestamp: hp.timestamp,
            gitBranch: firstEntry.gitBranch || undefined,
          },
          anchorConfig,
        );

        // Resolve project links from the session's working directory
        let repo: string | undefined;
        let branch: string | undefined;
        try {
          const { execSync } = await import("node:child_process");
          if (existsSync(join(sessionCwd, ".git"))) {
            repo = execSync("git remote get-url origin", { cwd: sessionCwd, encoding: "utf-8" }).trim() || undefined;
            branch = firstEntry.gitBranch || execSync("git branch --show-current", { cwd: sessionCwd, encoding: "utf-8" }).trim() || undefined;
          }
        } catch { /* no git */ }

        const meta: DecisionMeta = {
          seal: sealHash,
          ts: hp.timestamp || ts,
          type: hp.type,
          subtype: hp.subtype,
          intent: hp.intent,
          risk: hp.risk,
          context: hp.context,
          project: transcript.project,
          repo,
          branch,
          confidence: hp.confidence,
          horizon: hp.horizon,
          anchors,
          source: hp.source || "claude-code",
          status: "open",
          resolutions: [],
        };

        writeMeta(join(repoRoot, HANDPRINT_DIR), meta);
        chunkDecisions.push(hp);
        result.decisionsExtracted++;
      }

      if (chunkDecisions.length > 0) {
        result.details.push({ sealHash, decisions: chunkDecisions });
      }
    }
  }

  return result;
}
