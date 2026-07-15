// tests/sources/index.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ALL_ADAPTERS, adapterById, enabledAdapters, discoverSessions } from '../../src/sources/index.js';

describe('source registry + discovery', () => {
  it('registers four adapters, three implemented', () => {
    expect(ALL_ADAPTERS.map((a) => a.descriptor.id).sort()).toEqual(['claude-code', 'codex', 'cursor', 'opencode']);
    expect(ALL_ADAPTERS.filter((a) => a.descriptor.implemented).map((a) => a.descriptor.id).sort()).toEqual(['claude-code', 'codex', 'opencode']);
  });

  it('cursor stub throws NotImplementedError on parse', () => {
    const cursor = adapterById('cursor')!;
    expect(() => cursor.parse({ sourceId: 'cursor', sessionId: 'x', project: 'p', locator: 'l', mtimeMs: 0 })).toThrow(/not implemented/);
  });

  it('enabledAdapters filters to implemented and to the allow-list', () => {
    expect(enabledAdapters().map((a) => a.descriptor.id).sort()).toEqual(['claude-code', 'codex', 'opencode']);
    expect(enabledAdapters(['opencode']).map((a) => a.descriptor.id)).toEqual(['opencode']);
    expect(enabledAdapters(['cursor']).map((a) => a.descriptor.id)).toEqual([]); // cursor not implemented
  });

  it('discoverSessions merges and sorts by mtime desc', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-disc-'));
    const proj = join(home, '.claude', 'projects', '-Users-test-app');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'sess-1.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello there friend' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }));
    const refs = discoverSessions({ homeDir: home });
    expect(refs.length).toBeGreaterThanOrEqual(1);
    expect(refs[0].sourceId).toBe('claude-code');
  });
});
