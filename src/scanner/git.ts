export interface GitCommit {
  hash: string;
  timestamp: string;
  author: string;
  message: string;
}

export interface ScanCandidate {
  commit: GitCommit;
  suggestedType: string;
  signals: string[];
}

export function parseGitLog(raw: string): GitCommit[] {
  const lines = raw.split("\n").filter((l) => l.trim().length > 0);
  return lines.map((line) => {
    const parts = line.split("|");
    const hash = parts[0];
    const timestamp = parts[1];
    const author = parts[2];
    const message = parts.slice(3).join("|");
    return { hash, timestamp, author, message };
  });
}

const SKIP_PATTERNS: RegExp[] = [
  /^merge /i,
  /^chore: (?:update|bump|upgrade) dep/i,
  /^ci:/i,
  /^docs:/i,
  /^style:/i,
];

interface PatternCategory {
  type: string;
  patterns: RegExp[];
}

const CATEGORIES: PatternCategory[] = [
  {
    type: "override",
    patterns: [
      /instead of/i,
      /over (?:the|a) /i,
      /rather than/i,
      /replacing/i,
      /switch(?:ing|ed)? (?:from|to)/i,
      /chose .+ over/i,
    ],
  },
  {
    type: "rejection",
    patterns: [
      /remov(?:e|ing|ed)/i,
      /declin(?:e|ing|ed)/i,
      /not ready/i,
      /drop(?:ping|ped)?/i,
      /won't|will not/i,
      /rip(?:ping|ped)? out/i,
    ],
  },
  {
    type: "constraint",
    patterns: [
      /enforce/i,
      /never|always/i,
      /must not|cannot/i,
      /no .+ in .+ path/i,
      /boundary|guardrail/i,
      /cap(?:ped)? at/i,
    ],
  },
];

export function classifyCommit(commit: GitCommit): ScanCandidate | null {
  const msg = commit.message;

  for (const skip of SKIP_PATTERNS) {
    if (skip.test(msg)) return null;
  }

  let suggestedType: string | null = null;
  const signals: string[] = [];

  for (const category of CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(msg)) {
        if (suggestedType === null) {
          suggestedType = category.type;
        }
        signals.push(pattern.source);
      }
    }
  }

  if (suggestedType === null) return null;

  return { commit, suggestedType, signals };
}
