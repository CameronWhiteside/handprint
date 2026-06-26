export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  cwd: string;
  sessionId: string;
  gitBranch: string;
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
  gitBranch?: string;
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
      gitBranch: raw.gitBranch ?? "",
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
    type: "vision",
    patterns: [
      /(?:want|going) to (?:achieve|build|create|ship)/i,
      /goal is/i,
      /let's go with/i,
      /planning to/i,
      /the vision is/i,
      /aiming for/i,
      /direction is/i,
      /strategy is/i,
    ],
  },
  {
    type: "choice",
    patterns: [
      /instead/i,
      /no,? (?:use|do|go with|switch)/i,
      /not that/i,
      /rather than/i,
      /I(?:'d| would) prefer/i,
      /actually,? (?:use|do|let)/i,
      /decided/i,
      /not doing/i,
      /choosing/i,
      /(?:don't|do not|skip|remove|drop) (?:that|this|the)/i,
      /we(?:'re| are) not (?:building|doing|adding)/i,
      /off the table/i,
      /out of scope/i,
      /not (?:ready|worth|needed)/i,
      /decline/i,
      /never|always/i,
      /must not|cannot|can't/i,
      /(?:hard|strict) (?:rule|constraint|requirement)/i,
      /non-negotiable/i,
      /boundary/i,
    ],
  },
  {
    type: "method",
    patterns: [
      /using (?:the|a|this)/i,
      /with (?:the|a|this) (?:tool|library|framework|api|sdk)/i,
      /(?:cloudflare|aws|gcp|azure|vercel|netlify|supabase)/i,
      /(?:react|vue|svelte|next|nuxt|astro|hono|express)/i,
      /(?:postgres|redis|sqlite|drizzle|prisma)/i,
      /method/i,
      /powered by/i,
      /integrat(?:e|ing|ed)/i,
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
