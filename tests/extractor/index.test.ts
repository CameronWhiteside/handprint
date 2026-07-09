// tests/extractor/index.test.ts
import { describe, it, expect } from 'vitest';
import { resolveProvider, extractFromEntries } from '../../src/extractor/index.js';
import type { ExtractorProvider } from '../../src/extractor/types.js';
import type { TranscriptEntry } from '../../src/sources/types.js';

const mk = (role: 'user' | 'assistant', text: string): TranscriptEntry => ({ role, text, timestamp: '2026-06-01T10:00:00Z', cwd: '', sessionId: 's', gitBranch: '' });

describe('extractor resolver', () => {
  it('resolves host provider when config.provider=host', () => {
    const p = resolveProvider({ config: { provider: 'host', agentCli: 'claude' } });
    expect(p.id).toBe('host-agent');
  });

  it('defaults to host when an agent CLI is available', () => {
    const p = resolveProvider({ config: {}, homeDir: '/tmp/hp', detectHost: () => true });
    expect(p.id).toBe('host-agent');
  });

  it('falls back to the local model when no agent CLI is available', () => {
    const p = resolveProvider({ config: {}, homeDir: '/tmp/hp', detectHost: () => false });
    expect(p.id).toBe('local-model');
    expect(p.label()).toMatch(/^local:/);
  });

  it('extractFromEntries fans chunks through the provider', async () => {
    const fake: ExtractorProvider = {
      id: 'fake',
      label: () => 'fake',
      isAvailable: async () => true,
      extract: async () => [{ marks: [{ type: 'choice', subtype: 'override', note: 'n' }], artifacts: [], timestamp: 't' }],
    };
    const entries = [mk('user', 'use drizzle instead of prisma for the schema layer')];
    const out = await extractFromEntries(entries, fake);
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('n');
  });
});
