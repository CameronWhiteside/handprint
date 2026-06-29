import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
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

  it('filters by --days (recent session is included)', async () => {
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, days: 1, provider: fakeProvider(), log: () => {} });
    expect(res.plan.totalSessions).toBe(1);
  });

  it('drops sessions outside the --until window', async () => {
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, until: '2020-01-01', provider: fakeProvider(), log: () => {} });
    expect(res.plan.totalSessions).toBe(0);
    expect(res.plan.skippedOutOfRange).toBe(1);
  });

  it('skips sessions below --min-messages', async () => {
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, minMessages: 5, provider: fakeProvider(), log: () => {} });
    expect(res.plan.totalSessions).toBe(0);
    expect(res.plan.skippedTooSmall).toBe(1);
  });

  it('is idempotent: skips already-grabbed sessions, --redo forces a re-grab', async () => {
    const first = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, yes: true, provider: fakeProvider(), log: () => {} });
    expect(first.handprintsCreated).toBe(1);

    const second = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, provider: fakeProvider(), log: () => {} });
    expect(second.plan.totalSessions).toBe(0);
    expect(second.plan.skippedUnchanged).toBe(1);

    const redo = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, redo: true, provider: fakeProvider(), log: () => {} });
    expect(redo.plan.totalSessions).toBe(1);
  });

  it('re-grabs only the NEW activity when a session grows', async () => {
    // First grab takes the 2 existing messages.
    const first = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, yes: true, provider: fakeProvider(), log: () => {} });
    expect(first.handprintsCreated).toBe(1);

    // Append a newer message to the same session.
    const sess = join(CLAUDE_HOME, '.claude', 'projects', '-Users-test-app', 'sess-1.jsonl');
    appendFileSync(
      sess,
      '\n' + JSON.stringify({ type: 'user', message: { role: 'user', content: 'actually, also rate-limit the token endpoint hard' }, timestamp: '2026-06-02T09:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
    );

    // Dry run now sees exactly one new message, not the whole session.
    const grown = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, dryRun: true, provider: fakeProvider(), log: () => {} });
    expect(grown.plan.totalSessions).toBe(1);
    expect(grown.plan.totalMessages).toBe(1);
  });

  it('aborts with a clear reason when the runtime is not ready (no processing, no download)', async () => {
    const extract = vi.fn(async () => []);
    const provider: ExtractorProvider = {
      id: 'local-model',
      label: () => 'local:fake-model',
      isAvailable: async () => true,
      preflight: async () => ({ ok: false, reason: 'install node-llama-cpp' }),
      extract,
    };
    const res = await grab(TEST_PROJECT, { homeDir: CLAUDE_HOME, yes: true, provider, log: () => {} });
    expect(res.blockedReason).toBe('install node-llama-cpp');
    expect(res.confirmed).toBe(false);
    expect(extract).not.toHaveBeenCalled();
  });
});
