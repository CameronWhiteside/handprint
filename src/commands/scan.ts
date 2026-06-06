import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseGitLog, classifyCommit, type ScanCandidate } from "../scanner/git.js";
import {
  parseTranscriptLine,
  extractConversationPairs,
  classifyPair,
  type TranscriptCandidate,
} from "../scanner/claude-code.js";

export interface ScanResult {
  gitCandidates: ScanCandidate[];
  transcriptCandidates: TranscriptCandidate[];
}

export function scanGitHistory(repoRoot: string, limit: number = 50): ScanCandidate[] {
  try {
    const raw = execSync(`git log --format="%H|%aI|%an|%s" -n ${limit}`, {
      cwd: repoRoot,
      encoding: "utf-8",
    });
    const commits = parseGitLog(raw);
    return commits.map(classifyCommit).filter((c): c is ScanCandidate => c !== null);
  } catch {
    return [];
  }
}

export function scanClaudeTranscripts(claudeDir?: string): TranscriptCandidate[] {
  const baseDir = claudeDir ?? join(process.env.HOME ?? "~", ".claude", "projects");
  if (!existsSync(baseDir)) return [];

  const candidates: TranscriptCandidate[] = [];

  let projects: string[];
  try {
    projects = readdirSync(baseDir);
  } catch {
    return [];
  }

  for (const project of projects) {
    const projectDir = join(baseDir, project);
    let files: string[];
    try {
      files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files.slice(-5)) {
      const lines = readFileSync(join(projectDir, file), "utf-8").split("\n");
      const entries = lines
        .map(parseTranscriptLine)
        .filter((e): e is NonNullable<typeof e> => e !== null);
      const pairs = extractConversationPairs(entries);
      for (const pair of pairs) {
        const candidate = classifyPair(pair);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  return candidates;
}

export function scan(repoRoot: string, claudeDir?: string): ScanResult {
  return {
    gitCandidates: scanGitHistory(repoRoot),
    transcriptCandidates: scanClaudeTranscripts(claudeDir),
  };
}
