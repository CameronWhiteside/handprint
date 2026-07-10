// tests/extractor/window.test.ts
import { describe, it, expect } from 'vitest';
import { isNoise, chunkEntries, buildConversationWindow } from '../../src/extractor/window.js';
import type { TranscriptEntry } from '../../src/sources/types.js';

const mk = (role: 'user' | 'assistant', text: string): TranscriptEntry => ({ role, text, timestamp: '2026-06-01T10:00:00Z', cwd: '', sessionId: 's', gitBranch: '' });

describe('window builder', () => {
  it('flags system-reminder and short noise', () => {
    expect(isNoise(mk('user', '<system-reminder>hi</system-reminder>'))).toBe(true);
    expect(isNoise(mk('user', 'ok'))).toBe(true);
    expect(isNoise(mk('user', 'use drizzle instead of prisma for the schema'))).toBe(false);
  });

  it('builds a window with HUMAN/AI labels', () => {
    const w = buildConversationWindow([mk('user', 'use drizzle instead of prisma for the schema')]);
    expect(w).toContain('HUMAN:');
  });

  it('chunks by size', () => {
    const many = Array.from({ length: 50 }, (_, i) => mk('user', `decision number ${i} about architecture choices`));
    const chunks = chunkEntries(many, 200);
    expect(chunks.length).toBeGreaterThan(1);
  });

  it('caps AI turns shorter than human turns (asymmetric budget)', () => {
    const long = 'x'.repeat(2000);
    // A human turn flanking the AI turn keeps the AI turn "anchored" (fuller cap).
    const w = buildConversationWindow([mk('user', long), mk('assistant', long), mk('user', long)]);
    const human = w.split('\n\n').find((l) => l.includes('HUMAN:'))!;
    const ai = w.split('\n\n').find((l) => l.includes('AI:'))!;
    // Human keeps ~1000 chars; anchored AI is trimmed to ~300 — much shorter.
    expect(human.length).toBeGreaterThan(900);
    expect(ai.length).toBeLessThan(400);
    expect(ai).toContain('…'); // head+tail slice marker
  });

  it('collapses an unanchored AI run to a stub, keeps anchored AI fuller', () => {
    const long = 'x'.repeat(2000);
    // human, AI(anchored), AI(unanchored), AI(unanchored), human
    const entries = [
      mk('user', long),
      mk('assistant', long),
      mk('assistant', long),
      mk('assistant', long),
      mk('user', long),
    ];
    const aiLines = buildConversationWindow(entries)
      .split('\n\n')
      .filter((l) => l.includes('AI:'));
    expect(aiLines).toHaveLength(3);
    const [first, middle, last] = aiLines;
    // First and last AI turns touch a human turn → fuller (~300); the middle
    // one is autonomous narration → stub (~80).
    expect(first.length).toBeGreaterThan(200);
    expect(last.length).toBeGreaterThan(200);
    expect(middle.length).toBeLessThan(150);
  });

  it('trimming AI turns packs more entries per chunk (fewer LLM calls)', () => {
    const long = 'x'.repeat(2000);
    // Alternating so most AI turns are anchored; unanchored ones stub even harder.
    const entries = Array.from({ length: 40 }, (_, i) => mk(i % 2 === 0 ? 'user' : 'assistant', long));
    const chunks = chunkEntries(entries, 10000);
    // With a symmetric 1000-char cap this would be ~4 chunks; asymmetric packs more.
    const packed = chunks.reduce((n, c) => n + c.length, 0);
    expect(packed).toBe(40);
    expect(chunks.length).toBeLessThan(4);
  });

  it('truncates output when combined entry length exceeds maxChars', () => {
    // Each entry produces a long line; with maxChars=50 only the first fits.
    const entries = Array.from({ length: 10 }, (_, i) =>
      mk('user', `this is a moderately long decision entry number ${i} about architecture`)
    );
    const truncated = buildConversationWindow(entries, 50);
    const full = buildConversationWindow(entries, 999999);
    expect(truncated.length).toBeLessThan(full.length);
  });
});
