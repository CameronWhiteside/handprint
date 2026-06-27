// src/extractor/window.ts
import type { TranscriptEntry } from '../sources/types.js';

export function buildChunkPlaintext(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const role = e.role === 'user' ? 'user' : 'assistant';
      const time = e.timestamp.slice(11, 16);
      return `[${role} ${time}] ${e.text.slice(0, 1000)}`;
    })
    .join('\n');
}

export function isNoise(entry: TranscriptEntry): boolean {
  const t = entry.text;
  if (t.startsWith('Base directory for this skill')) return true;
  if (t.startsWith('<local-command-caveat>')) return true;
  if (t.startsWith('<command-name>')) return true;
  if (t.startsWith('<task-notification>')) return true;
  if (t.startsWith('This session is being continued from')) return true;
  if (t.startsWith('<system-reminder>')) return true;
  if (t.length < 15) return true;
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
  for (const e of clean) {
    const role = e.role === 'user' ? 'HUMAN' : 'AI';
    const ts = e.timestamp.slice(0, 19);
    const text = e.text.slice(0, 600);
    const line = `[${ts}] ${role}: ${text}`;
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
