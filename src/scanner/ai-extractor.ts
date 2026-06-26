import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { parseTranscriptLine, type TranscriptEntry } from "./claude-code.js";

export interface ExtractedHandprint {
  type: "vision" | "choice" | "method";
  subtype?: string;
  intent: string;
  risk: string;
  context: string;
  horizon: string | null;
  confidence: number;
  source: string;
  quote: string;
  timestamp: string;
}

export interface ExtractionResult {
  handprints: ExtractedHandprint[];
  sessionId: string;
  project: string;
  messagesAnalyzed: number;
}

function isNoise(entry: TranscriptEntry): boolean {
  const t = entry.text;
  if (t.startsWith("Base directory for this skill")) return true;
  if (t.startsWith("<local-command-caveat>")) return true;
  if (t.startsWith("<command-name>")) return true;
  if (t.startsWith("<task-notification>")) return true;
  if (t.startsWith("This session is being continued from")) return true;
  if (t.startsWith("<system-reminder>")) return true;
  if (t.length < 15) return true;
  if (entry.role === "user" && t.startsWith("{")) return true;
  if (entry.role === "user" && t.includes("tool_result")) return true;
  return false;
}

function buildConversationWindow(
  entries: TranscriptEntry[],
  maxChars: number = 12000,
): string {
  const clean = entries.filter((e) => !isNoise(e));
  const lines: string[] = [];
  let total = 0;
  for (const e of clean) {
    const role = e.role === "user" ? "HUMAN" : "AI";
    const ts = e.timestamp.slice(0, 19);
    const text = e.text.slice(0, 600);
    const line = `[${ts}] ${role}: ${text}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length;
  }
  return lines.join("\n\n");
}

const SYSTEM_PROMPT = `You are a handprint detector. You analyze conversations between a human and an AI coding assistant to identify moments of human judgment — decisions where the human steered the work rather than just accepting what the AI suggested.

There are three types of handprints, each with subtypes:

1. **vision** — What did the human want to achieve? Goal-setting, direction, planning.
   Subtypes: goal, direction, bet
   "Switching the pipeline to streaming so latency drops below 100ms." "We're building a CLI tool for decision provenance."

2. **choice** — What decisions did the human make? Overrides, rejections, constraints, trade-offs.
   Subtypes: override, rejection, constraint, wager, direction
   "No, use edge JWT instead of the centralized gateway." "We're not adding a recommendations engine in v2." "Never use gendered language in tile suggestions."

3. **method** — What tools and knowledge did the human apply? Tool selection, framework choices, integrations.
   Subtypes: tools, knowledge
   "Using Cloudflare Workers with Hono for the API layer." "Wire up Drizzle ORM instead of raw SQL."

IMPORTANT rules:
- Only flag moments where a HUMAN made a real decision that shaped the work
- Routine instructions ("format the code", "deploy please", "commit and push") are NOT handprints
- Approvals of AI suggestions ("yes", "go ahead", "looks good") are NOT handprints unless the human adds meaningful constraints
- The human choosing between options the AI presented IS a handprint (vision or choice)
- "Never do X" and "always do Y" are choices (constraints)
- Short steering corrections ("no, use X instead") count as choices
- Tool/framework/library selections are method
- Extract the EXACT quote from the human that constitutes the handprint

For each handprint, extract:
- type: one of vision, choice, method
- subtype: the specific subtype within the type (see lists above)
- intent: one sentence capturing what the human decided (in third person, like a log entry)
- risk: what could go wrong if this decision is wrong (one sentence)
- context: the project/feature area this applies to
- horizon: ISO 8601 duration if there's a time component (P3M, P12M, etc.), or null
- confidence: how confident you are this is a real handprint (0.0-1.0)
- quote: the exact human text that constitutes the handprint (keep it short, max ~150 chars)
- timestamp: the timestamp from the conversation

Respond ONLY with a JSON array. No markdown, no explanation. If no handprints found, return [].
Only include handprints with confidence >= 0.7.`;

function getCloudflareAuth(): { accountId: string; token: string } {
  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    return {
      accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
      token: process.env.CLOUDFLARE_API_TOKEN,
    };
  }

  const configPath = join(
    process.env.HOME ?? "~",
    ".wrangler",
    "config",
    "default.toml",
  );
  if (!existsSync(configPath)) {
    throw new Error(
      "no Cloudflare credentials found — set CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN, or run 'wrangler login'",
    );
  }
  const config = readFileSync(configPath, "utf-8");
  const tokenMatch = config.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!tokenMatch)
    throw new Error(
      "no wrangler OAuth token found — run 'wrangler login' first",
    );

  const whoami = execSync("npx wrangler whoami 2>&1", { encoding: "utf-8" });
  const lines = whoami.split("\n");
  let accountId: string | null = null;
  for (const line of lines) {
    const match = line.match(/([a-f0-9]{32})/);
    if (match) accountId = match[1];
  }
  if (!accountId)
    throw new Error(
      "no Cloudflare account found — run 'wrangler whoami' to check",
    );

  return { accountId, token: tokenMatch[1] };
}

async function callWorkersAI(
  prompt: string,
  systemPrompt: string,
): Promise<string> {
  const { accountId, token } = getCloudflareAuth();
  const model = "@cf/meta/llama-3.1-70b-instruct";

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt },
        ],
        max_tokens: 4096,
      }),
    },
  );

  const data = (await response.json()) as {
    result?: { response?: string };
    success: boolean;
    errors?: Array<{ message: string }>;
  };

  if (!data.success || !data.result?.response) {
    const errMsg =
      data.errors?.map((e) => e.message).join(", ") ?? "unknown error";
    throw new Error(`Workers AI error: ${errMsg}`);
  }

  return data.result.response;
}

function chunkEntries(
  entries: TranscriptEntry[],
  maxCharsPerChunk: number = 10000,
): TranscriptEntry[][] {
  const clean = entries.filter((e) => !isNoise(e));
  const chunks: TranscriptEntry[][] = [];
  let current: TranscriptEntry[] = [];
  let currentSize = 0;

  for (const e of clean) {
    const size = e.text.slice(0, 600).length + 50;
    if (currentSize + size > maxCharsPerChunk && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(e);
    currentSize += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

export async function extractHandprintsFromTranscript(
  entries: TranscriptEntry[],
  sessionId: string,
  project: string,
): Promise<ExtractionResult> {
  const chunks = chunkEntries(entries);
  if (chunks.length === 0) {
    return { handprints: [], sessionId, project, messagesAnalyzed: 0 };
  }

  const allHandprints: ExtractedHandprint[] = [];

  for (let i = 0; i < chunks.length; i++) {
    const window = buildConversationWindow(chunks[i]);
    if (!window.trim()) continue;

    console.error(
      `  chunk ${i + 1}/${chunks.length} (${chunks[i].length} messages)...`,
    );

    const prompt = `Analyze this conversation and extract any handprints (human decision moments):\n\n${window}`;

    try {
      const text = await callWorkersAI(prompt, SYSTEM_PROMPT);
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) continue;

      const raw = JSON.parse(jsonMatch[0]) as ExtractedHandprint[];
      allHandprints.push(...raw.filter((h) => h.confidence >= 0.7));
    } catch (err) {
      console.error(`  chunk ${i + 1} error: ${(err as Error).message}`);
    }
  }

  return {
    handprints: allHandprints,
    sessionId,
    project,
    messagesAnalyzed: entries.length,
  };
}

export function loadTranscriptEntries(filePath: string): TranscriptEntry[] {
  const lines = readFileSync(filePath, "utf-8").split("\n");
  return lines
    .map(parseTranscriptLine)
    .filter((e): e is TranscriptEntry => e !== null);
}

export function discoverTranscripts(
  claudeDir?: string,
): Array<{ path: string; sessionId: string; project: string }> {
  const baseDir =
    claudeDir ?? join(process.env.HOME ?? "~", ".claude", "projects");
  if (!existsSync(baseDir)) return [];

  const results: Array<{
    path: string;
    sessionId: string;
    project: string;
  }> = [];

  for (const project of readdirSync(baseDir)) {
    const projectDir = join(baseDir, project);
    let files: string[];
    try {
      files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));
    } catch {
      continue;
    }

    for (const file of files) {
      const sessionId = file.replace(".jsonl", "");
      results.push({
        path: join(projectDir, file),
        sessionId,
        project: project.replace(/-/g, "/").replace(/^\/Users\//, "~/"),
      });
    }
  }

  return results;
}
