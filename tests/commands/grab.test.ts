import { describe, it, expect, vi } from 'vitest';
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

function fakeProvider(extract = vi.fn(async () => [])): ExtractorProvider {
  return { id: 'fake', label: () => 'local:fake-model', isAvailable: async () => true, extract };
}

describe('grab', () => {
  it('dry run is a quick scan: discovers scope WITHOUT calling the model', async () => {
    const extract = vi.fn(async () => []);
    const res = await grab('/Users/test/app', {
      homeDir: claudeHome(),
      dryRun: true,
      provider: fakeProvider(extract),
      log: () => {},
    });
    expect(extract).not.toHaveBeenCalled(); // the model is never invoked on a dry run
    expect(res.dryRun).toBe(true);
    expect(res.handprintsCreated).toBe(0);
    expect(res.sessionsScanned).toBe(1);
    expect(res.messagesScanned).toBeGreaterThan(0);
    expect(res.projectsScanned).toBe(1);
    expect(res.extractor).toBe('local:fake-model');
    expect(res.preview).toHaveLength(1);
    expect(res.preview[0].messages).toBeGreaterThan(0);
    expect(res.preview[0].chunks).toBeGreaterThanOrEqual(1);
  });

  it('reports the configured extractor and scope in the result', async () => {
    const res = await grab('/Users/test/app', {
      homeDir: claudeHome(),
      dryRun: true,
      provider: fakeProvider(),
      log: () => {},
    });
    expect(res.extractor).toBe('local:fake-model');
    expect(typeof res.elapsedMs).toBe('number');
  });

  it('honors the --source filter (opencode finds no claude sessions)', async () => {
    const res = await grab('/Users/test/app', {
      homeDir: claudeHome(),
      dryRun: true,
      source: 'opencode',
      provider: fakeProvider(),
      log: () => {},
    });
    expect(res.sessionsScanned).toBe(0);
    expect(res.preview).toHaveLength(0);
  });
});
