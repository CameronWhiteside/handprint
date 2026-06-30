import { describe, it, expect, vi } from 'vitest';
import { extractFromEntries } from '../../src/extractor/index.js';
import type { ExtractorProvider } from '../../src/extractor/types.js';
import type { TranscriptEntry } from '../../src/sources/types.js';

const entry = (text: string): TranscriptEntry => ({
  role: 'user',
  text,
  timestamp: '2026-06-01T10:00:00Z',
  cwd: '/x',
  sessionId: 's',
  gitBranch: 'main',
});

describe('extractFromEntries fail-fast', () => {
  it('stops on the first chunk error instead of processing the rest', async () => {
    const extract = vi.fn(async () => {
      throw new Error('claude did not return a JSON array');
    });
    const provider: ExtractorProvider = { id: 'x', label: () => 'x', isAvailable: async () => true, extract };
    await expect(
      extractFromEntries([entry('We decided to use Drizzle ORM for type-safe queries across the app.')], provider),
    ).rejects.toThrow(/first chunk/);
    expect(extract).toHaveBeenCalledTimes(1);
  });
});
