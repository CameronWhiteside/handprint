// src/extractor/types.ts
import type { Mark, Artifact } from '@handprint/types';
import { markSchema, artifactSchema } from '@handprint/types';

export interface RawExtraction {
  marks: Mark[];
  artifacts: Artifact[];
  timestamp: string;
}

export interface ExtractorProvider {
  id: string;
  label(): string;
  isAvailable(): Promise<boolean>;
  extract(window: string, system: string): Promise<RawExtraction[]>;
}

export const SYSTEM_PROMPT = `You are a handprint detector. You analyze conversations between a human and an AI assistant to identify moments of human judgment — decisions where the human steered the work.

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

export function parseExtractionJson(text: string): RawExtraction[] {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];
  let raw: unknown;
  try {
    raw = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(raw)) return [];

  const out: RawExtraction[] = [];
  for (const item of raw) {
    if (item === null || typeof item !== 'object') continue;
    const rec = item as { marks?: unknown[]; artifacts?: unknown[]; timestamp?: string };
    const marks: Mark[] = [];
    const artifacts: Artifact[] = [];
    for (const m of rec.marks ?? []) {
      const parsed = markSchema.safeParse(m);
      if (parsed.success) marks.push(parsed.data);
    }
    for (const a of rec.artifacts ?? []) {
      const parsed = artifactSchema.safeParse(a);
      if (parsed.success) artifacts.push(parsed.data);
    }
    if (marks.length === 0) continue;
    out.push({ marks, artifacts, timestamp: rec.timestamp ?? new Date().toISOString() });
  }
  return out;
}
