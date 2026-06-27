// src/extractor/types.ts
import type { Mark, Artifact } from '@handprint/types';
import { markSchema, artifactSchema } from '@handprint/types';

export interface RawExtraction {
  marks: Mark[];
  artifacts: Artifact[];
  timestamp: string;
  sourcePlaintext?: string;
}

export interface ExtractorProvider {
  id: string;
  label(): string;
  isAvailable(): Promise<boolean>;
  extract(window: string, system: string): Promise<RawExtraction[]>;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Yields each balanced [...] slice from text in order of occurrence.
function* scanJsonArrays(text: string): Generator<string> {
  let pos = text.indexOf('[');
  while (pos !== -1) {
    let depth = 0, inStr = false, esc = false;
    let end = -1;
    for (let i = pos; i < text.length; i++) {
      const c = text[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
      } else if (c === '"') inStr = true;
      else if (c === '[') depth++;
      else if (c === ']') { depth--; if (depth === 0) { end = i; break; } }
    }
    if (end === -1) break;
    yield text.slice(pos, end + 1);
    pos = text.indexOf('[', end + 1);
  }
}

// Guard: accept only strings that are valid ISO-8601 datetimes (YYYY-MM-DDTHH:...).
// Rejects arbitrary attacker-controlled strings stored as timestamps.
function isValidIsoTimestamp(v: unknown): v is string {
  return (
    typeof v === 'string' &&
    /^\d{4}-\d{2}-\d{2}T/.test(v) &&
    !Number.isNaN(Date.parse(v))
  );
}

export function parseExtractionJson(text: string, opts?: { requireLeadingArray?: boolean }): RawExtraction[] {
  // Item 3: reject leading prose, if the caller requires the text to start
  // directly with a JSON array, bail out early instead of scanning for an
  // embedded array (prevents JSON front-running in host-agent output).
  if (opts?.requireLeadingArray && !text.trimStart().startsWith('[')) {
    return [];
  }

  for (const slice of scanJsonArrays(text)) {
    let raw: unknown;
    try {
      raw = JSON.parse(slice);
    } catch {
      continue;
    }
    if (!Array.isArray(raw)) continue;

    const out: RawExtraction[] = [];
    for (const item of raw) {
      if (!isRecord(item)) continue;
      const marks: Mark[] = [];
      const artifacts: Artifact[] = [];
      for (const m of Array.isArray(item['marks']) ? item['marks'] : []) {
        const parsed = markSchema.safeParse(m);
        if (parsed.success) marks.push(parsed.data);
      }
      for (const a of Array.isArray(item['artifacts']) ? item['artifacts'] : []) {
        const parsed = artifactSchema.safeParse(a);
        if (parsed.success) artifacts.push(parsed.data);
      }
      if (marks.length === 0) continue;
      // Item 4: validate timestamp as ISO-8601; fall back to now() to avoid
      // storing arbitrary attacker-controlled strings.
      const ts = item['timestamp'];
      out.push({ marks, artifacts, timestamp: isValidIsoTimestamp(ts) ? ts : new Date().toISOString() });
    }
    // Return results from the first array that parses (even if out is empty after filtering).
    return out;
  }
  return [];
}
