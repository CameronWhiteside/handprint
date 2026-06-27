import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { parseTranscriptLine, type TranscriptEntry } from "./claude-code.js";
import type { Mark, Artifact } from "@handprint/types";
import { markSchema, artifactSchema } from "@handprint/types";

export interface ExtractedHandprint {
  marks: Mark[];
  artifacts: Artifact[];
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

const SYSTEM_PROMPT = `You are a handprint detector. You analyze conversations between a human and an AI assistant to identify moments of human judgment — decisions where the human steered the work.

There are three types of marks:

1. **vision** — What the human wants to achieve.
   Subtypes: goal, direction, principle

2. **choice** — Decisions the human made.
   Subtypes: approval, override, rejection, constraint, inquiry

3. **method** — Tools and knowledge the human applied.
   Subtypes: tool, knowledge, process

For each decision moment, return an object with:
- marks: array of { type, subtype, note } — note is 1-280 chars describing the decision
- artifacts: array of { type, uri } — any outputs referenced (git-commit, file, url, deployment, etc.)
- timestamp: the ISO timestamp from the conversation

IMPORTANT:
- Only flag moments where a HUMAN made a real decision
- Routine instructions are NOT handprints
- Simple approvals without constraints are NOT handprints
- "Never do X" / "always do Y" = choice/constraint
- Tool/framework selections = method/tool or method/process
- Each note should be a concise third-person description of what the human decided

Respond ONLY with a JSON array. No markdown. If none found, return [].`;

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

      const raw = JSON.parse(jsonMatch[0]) as Array<{
        marks?: unknown[];
        artifacts?: unknown[];
        timestamp?: string;
      }>;

      for (const item of raw) {
        const marks: Mark[] = [];
        const artifacts: Artifact[] = [];

        for (const m of item.marks ?? []) {
          const parsed = markSchema.safeParse(m);
          if (parsed.success) marks.push(parsed.data);
        }

        for (const a of item.artifacts ?? []) {
          const parsed = artifactSchema.safeParse(a);
          if (parsed.success) artifacts.push(parsed.data);
        }

        if (marks.length === 0) continue;

        allHandprints.push({
          marks,
          artifacts,
          timestamp: item.timestamp ?? new Date().toISOString(),
        });
      }
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

  results.sort((a, b) => {
    try {
      return statSync(b.path).mtimeMs - statSync(a.path).mtimeMs;
    } catch {
      return 0;
    }
  });

  return results;
}
