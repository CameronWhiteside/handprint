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
});
