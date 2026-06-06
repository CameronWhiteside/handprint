export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  cwd: string;
  sessionId: string;
}

export interface ConversationPair {
  user: TranscriptEntry;
  assistant: TranscriptEntry;
}

export interface TranscriptCandidate {
  pair: ConversationPair;
  suggestedType: string;
  signals: string[];
}

interface ContentItem {
  type: string;
  text?: string;
}

interface RawEntry {
  type: string;
  message?: {
    role: string;
    content: string | ContentItem[];
  };
  timestamp?: string;
  cwd?: string;
  sessionId?: string;
}

function extractText(content: string | ContentItem[]): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  const textParts: string[] = [];
  for (const item of content) {
    if (item.type === "text" && typeof item.text === "string") {
      textParts.push(item.text);
    }
  }
  return textParts.join("");
}

export function parseTranscriptLine(line: string): TranscriptEntry | null {
  try {
    const raw: RawEntry = JSON.parse(line);

    if (raw.type !== "user" && raw.type !== "assistant") return null;
    if (!raw.message) return null;

    const text = extractText(raw.message.content);
    if (!text) return null;

    return {
      role: raw.type as "user" | "assistant",
      text,
      timestamp: raw.timestamp ?? "",
      cwd: raw.cwd ?? "",
      sessionId: raw.sessionId ?? "",
    };
  } catch {
    return null;
  }
}

export function extractConversationPairs(
  entries: TranscriptEntry[],
): ConversationPair[] {
  const pairs: ConversationPair[] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    if (entries[i].role === "user" && entries[i + 1].role === "assistant") {
      pairs.push({ user: entries[i], assistant: entries[i + 1] });
    }
  }
  return pairs;
}

interface PatternCategory {
  type: string;
  patterns: RegExp[];
}

const CATEGORIES: PatternCategory[] = [
  {
    type: "override",
    patterns: [
      /instead/i,
      /no,? (?:use|do|go with|switch)/i,
      /not that/i,
      /rather than/i,
      /I(?:'d| would) prefer/i,
      /let's go with/i,
      /actually,? (?:use|do|let)/i,
    ],
  },
  {
    type: "rejection",
    patterns: [
      /(?:don't|do not|skip|remove|drop) (?:that|this|the)/i,
      /we(?:'re| are) not (?:building|doing|adding)/i,
      /off the table/i,
      /out of scope/i,
      /not (?:ready|worth|needed)/i,
      /decline/i,
    ],
  },
  {
    type: "constraint",
    patterns: [
      /never|always/i,
      /must not|cannot|can't/i,
      /(?:hard|strict) (?:rule|constraint|requirement)/i,
      /non-negotiable/i,
      /boundary/i,
    ],
  },
  {
    type: "wager",
    patterns: [
      /I (?:bet|predict|think|expect) .+ will/i,
      /betting (?:that|on)/i,
      /within \d+ months/i,
      /by (?:Q[1-4]|next|end of)/i,
    ],
  },
];

export function classifyPair(
  pair: ConversationPair,
): TranscriptCandidate | null {
  const text = pair.user.text;

  let suggestedType: string | null = null;
  const signals: string[] = [];

  for (const category of CATEGORIES) {
    for (const pattern of category.patterns) {
      if (pattern.test(text)) {
        if (suggestedType === null) {
          suggestedType = category.type;
        }
        signals.push(pattern.source);
      }
    }
  }

  if (suggestedType === null) return null;

  return { pair, suggestedType, signals };
}
