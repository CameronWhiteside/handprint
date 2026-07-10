// src/extractor/window.ts
import type { TranscriptEntry } from '../sources/types.js';

// Stored plaintext (the audit record) keeps the fuller symmetric cap so it
// stays the more complete record even when the model window trims harder.
const ENTRY_TEXT_MAX = 1000;

// Model-window caps are ASYMMETRIC: the human turns carry almost all the signal
// (measured ~16% of chars but ~all the decisions), so humans keep the full cap
// while AI turns are trimmed. Two AI cases:
//   - anchored  (immediately before/after a human turn): the proposal a human
//     replied to — kept, head+tail so both the summary and the closing question
//     survive the slice.
//   - unanchored (a run of autonomous AI work the human never replied to): no
//     human decision can cite it, so collapse to a short stub — enough for a
//     later "go back to your first idea" to still resolve.
// ponytail: 300/80 measured a good balance; tune here if an eval moves it.
const HUMAN_TEXT_MAX = 1000;
const AI_TEXT_MAX = 300;
const AI_STUB_MAX = 80;

/** Head+tail slice with an ellipsis: AI turns front-load a summary and end with
 *  a question/proposal, so keeping both ends preserves what a human reply refers to. */
function sliceHeadTail(text: string, max: number): string {
  if (text.length <= max) return text;
  const head = Math.ceil((max - 1) * 0.7);
  const tail = max - 1 - head;
  return `${text.slice(0, head)}…${text.slice(text.length - tail)}`;
}

/** The text an entry contributes to the model window (asymmetric + anchoring).
 *  `entries` must be the noise-filtered list so adjacency ignores tool noise. */
function renderWindowText(entries: TranscriptEntry[], i: number): string {
  const e = entries[i];
  if (e.role === 'user') return e.text.slice(0, HUMAN_TEXT_MAX);
  const anchored = entries[i - 1]?.role === 'user' || entries[i + 1]?.role === 'user';
  return sliceHeadTail(e.text, anchored ? AI_TEXT_MAX : AI_STUB_MAX);
}

export function buildChunkPlaintext(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const role = e.role === 'user' ? 'user' : 'assistant';
      const time = e.timestamp.slice(11, 16);
      return `[${role} ${time}] ${e.text.slice(0, ENTRY_TEXT_MAX)}`;
    })
    .join('\n');
}

export function isNoise(entry: TranscriptEntry): boolean {
  const t = entry.text;
  // An entry that touched files carries repo-attribution signal even with little
  // or no text (a pure tool_use message), so it is never noise.
  const touchedFiles = (entry.paths?.length ?? 0) > 0;
  if (t.startsWith('Base directory for this skill')) return true;
  if (t.startsWith('<local-command-caveat>')) return true;
  if (t.startsWith('<command-name>')) return true;
  if (t.startsWith('<task-notification>')) return true;
  if (t.startsWith('This session is being continued from')) return true;
  if (t.startsWith('<system-reminder>')) return true;
  if (t.length < 15 && !touchedFiles) return true;
  if (entry.role === 'user' && t.startsWith('{')) return true;
  if (entry.role === 'user' && t.includes('tool_result')) return true;
  return false;
}

export function buildConversationWindow(
  entries: TranscriptEntry[],
  maxChars = 12000,
): string {
  const clean = entries.filter((e) => !isNoise(e));
  const lines: string[] = [];
  let total = 0;
  for (let i = 0; i < clean.length; i++) {
    const e = clean[i];
    const role = e.role === 'user' ? 'HUMAN' : 'AI';
    const ts = e.timestamp.slice(0, 19);
    const line = `[${ts}] ${role}: ${renderWindowText(clean, i)}`;
    if (total + line.length > maxChars) break;
    lines.push(line);
    total += line.length;
  }
  return lines.join('\n\n');
}

export function chunkEntries(
  entries: TranscriptEntry[],
  maxCharsPerChunk = 10000,
): TranscriptEntry[][] {
  const clean = entries.filter((e) => !isNoise(e));
  const chunks: TranscriptEntry[][] = [];
  let current: TranscriptEntry[] = [];
  let currentSize = 0;
  // Size on the trimmed window text (not raw), so trimming AI turns actually
  // packs more entries per chunk — fewer chunks means fewer LLM calls, the win.
  for (let i = 0; i < clean.length; i++) {
    const size = renderWindowText(clean, i).length + 50;
    if (currentSize + size > maxCharsPerChunk && current.length > 0) {
      chunks.push(current);
      current = [];
      currentSize = 0;
    }
    current.push(clean[i]);
    currentSize += size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}
