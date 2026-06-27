// tests/commands/grab.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grab } from '../../src/commands/grab.js';
import type { ExtractorProvider } from '../../src/extractor/types.js';

function claudeHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-grab-'));
  const proj = join(home, '.claude', 'projects', '-Users-test-app');
  mkdirSync(proj, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use edge JWT instead of the centralized gateway' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Switching to edge JWT validation.' }] }, timestamp: '2026-06-01T10:00:05Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
  ].join('\n');
  writeFileSync(join(proj, 'sess-1.jsonl'), lines);
  return home;
}

const fakeProvider: ExtractorProvider = {
  id: 'fake',
  label: () => 'local:fake-model',
  isAvailable: async () => true,
  extract: async () => [{ marks: [{ type: 'choice', subtype: 'override', note: 'chose edge JWT over gateway' }], artifacts: [], timestamp: '2026-06-01T10:00:00Z' }],
};

describe('grab (dry-run, injected provider)', () => {
  it('discovers claude sessions and records agent + extractor provenance', async () => {
    const res = await grab('/Users/test/app', { homeDir: claudeHome(), dryRun: true, provider: fakeProvider });
    expect(res.handprintsCreated).toBe(1);
    expect(res.details[0].agent).toBe('claude-code');
    expect(res.details[0].extractor).toBe('local:fake-model');
    expect(res.details[0].marks[0].note).toContain('edge JWT');
  });

  it('honors --source filter (opencode → no claude sessions found)', async () => {
    const res = await grab('/Users/test/app', { homeDir: claudeHome(), dryRun: true, source: 'opencode', provider: fakeProvider });
    expect(res.sessionsScanned).toBe(0);
  });
});
