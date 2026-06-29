import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { grab } from '../../src/commands/grab.js';
import type { ExtractorProvider, RawExtraction } from '../../src/extractor/types.js';

let TEST_HOME: string;
let TEST_PROJECT: string;
let CLAUDE_HOME: string;

function writeClaudeSession(home: string): void {
  const proj = join(home, '.claude', 'projects', '-Users-test-app');
  mkdirSync(proj, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use edge JWT instead of the centralized gateway' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Switching to edge JWT validation now.' }] }, timestamp: '2026-06-01T10:00:05Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
  ].join('\n');
  writeFileSync(join(proj, 'sess-1.jsonl'), lines);
}

function fakeProvider(
  extract = vi.fn(
    async (): Promise<RawExtraction[]> => [
      { marks: [{ type: 'choice', subtype: 'override', note: 'chose edge JWT' }], artifacts: [], timestamp: '2026-06-01T10:00:00Z' },
    ],
  ),
): ExtractorProvider {
  return { id: 'fake', label: () => 'local:fake-model', isAvailable: async () => true, extract };
}

describe('grab scan / confirm / target', () => {
  beforeEach(async () => {
    TEST_HOME = mkdtempSync(join(tmpdir(), 'hp-grab-home-'));
    TEST_PROJECT = mkdtempSync(join(tmpdir(), 'hp-grab-proj-'));
    CLAUDE_HOME = mkdtempSync(join(tmpdir(), 'hp-grab-claude-'));
    process.env.HANDPRINT_HOME = TEST_HOME;
    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    await initGlobal({ handle: '@cameronwhiteside', name: 'Cameron', email: 'c@d.e' });
    initProject(TEST_PROJECT);
    writeClaudeSession(CLAUDE_HOME);
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    rmSync(CLAUDE_HOME, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('dry run scans scope and never calls the model', async () => {
    const extract = vi.fn(async () => []);
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, provider: fakeProvider(extract), log: () => {} });
    expect(extract).not.toHaveBeenCalled();
    expect(res.dryRun).toBe(true);
    expect(res.confirmed).toBe(false);
    expect(res.plan.totalSessions).toBe(1);
    expect(res.plan.totalMessages).toBeGreaterThan(0);
    expect(res.plan.projects).toHaveLength(1);
    expect(res.plan.extractor).toBe('local:fake-model');
    expect(res.handprintsCreated).toBe(0);
  });

  it('with no confirm handler and no --yes, stops safely (nothing processed)', async () => {
    const extract = vi.fn(async () => []);
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, provider: fakeProvider(extract), log: () => {} });
    expect(res.needsConfirm).toBe(true);
    expect(res.confirmed).toBe(false);
    expect(extract).not.toHaveBeenCalled();
    expect(res.handprintsCreated).toBe(0);
  });

  it('--yes processes everything', async () => {
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, yes: true, provider: fakeProvider(), log: () => {} });
    expect(res.confirmed).toBe(true);
    expect(res.sessionsProcessed).toBe(1);
    expect(res.handprintsCreated).toBe(1);
  });

  it('confirm decline processes nothing', async () => {
    const extract = vi.fn(async () => []);
    const res = await grab(TEST_PROJECT, {
      homeDir: CLAUDE_HOME,
      confirm: async () => ({ proceed: false }),
      provider: fakeProvider(extract),
      log: () => {},
    });
    expect(res.confirmed).toBe(false);
    expect(extract).not.toHaveBeenCalled();
  });

  it('confirm with a project selection processes only the chosen project', async () => {
    const res = await grab(TEST_PROJECT, {
      homeDir: CLAUDE_HOME,
      confirm: async (plan) => ({ proceed: true, projects: [plan.projects[0].project] }),
      provider: fakeProvider(),
      log: () => {},
    });
    expect(res.confirmed).toBe(true);
    expect(res.handprintsCreated).toBe(1);
  });

  it('--project filter with no match yields an empty plan', async () => {
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, project: ['definitely-not-a-project'], provider: fakeProvider(), log: () => {} });
    expect(res.plan.totalSessions).toBe(0);
  });
});
