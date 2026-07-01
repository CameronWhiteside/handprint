// src/extractor/dedupe.ts
import type { Mark } from '@handprint/types';
import type { RawExtraction } from './types.js';

const STOPWORDS = new Set([
  'the',
  'a',
  'an',
  'to',
  'of',
  'and',
  'or',
  'from',
  'with',
  'for',
  'in',
  'on',
  'old',
  'new',
]);

// Light suffix-stripping so tense/inflection variants of the same word
// ("retire" / "retiring", "migrate" / "migrated") land on one token instead
// of splitting near-duplicate notes across two "different" words.
function stem(word: string): string {
  let s = word;
  if (s.endsWith('ing') && s.length > 5) s = s.slice(0, -3);
  else if (s.endsWith('ed') && s.length > 4) s = s.slice(0, -2);
  if (s.endsWith('e') && s.length > 3) s = s.slice(0, -1);
  return s;
}

/** Lowercase, strip punctuation, drop stopwords, lightly stem -> a token set for Jaccard similarity. */
function normalizedTokens(note: string): Set<string> {
  const tokens = note
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t))
    .map(stem);
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let intersection = 0;
  for (const t of a) if (b.has(t)) intersection++;
  const union = a.size + b.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const SIMILARITY_THRESHOLD = 0.6;

/**
 * Dedupe near-duplicate marks across an entire session's extractions.
 *
 * A chunked session can independently re-describe the same decision in
 * several chunks ("Decided to migrate X to Y" / "Chose to migrate X to Y and
 * retire the old system" / ...), producing 2-3 chips for one real decision.
 * Two marks are considered duplicates when they share the same `type` and
 * `subtype` AND their normalized notes overlap by >= SIMILARITY_THRESHOLD
 * Jaccard similarity over token sets. The first occurrence (in extraction
 * order) is kept; later duplicates are dropped. Extractions left with zero
 * marks after dropping are removed entirely; their artifacts/timestamp are
 * discarded along with them.
 */
export function dedupeMarks(extractions: RawExtraction[]): RawExtraction[] {
  const kept: Array<{ mark: Mark; tokens: Set<string> }> = [];

  const isDuplicate = (mark: Mark): boolean => {
    const tokens = normalizedTokens(mark.note);
    for (const k of kept) {
      if (k.mark.type !== mark.type || k.mark.subtype !== mark.subtype) continue;
      if (jaccard(k.tokens, tokens) >= SIMILARITY_THRESHOLD) return true;
    }
    kept.push({ mark, tokens });
    return false;
  };

  const out: RawExtraction[] = [];
  for (const extraction of extractions) {
    const marks = extraction.marks.filter((m) => !isDuplicate(m));
    if (marks.length === 0) continue;
    out.push({ ...extraction, marks });
  }
  return out;
}
