import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { listSources } from '../../src/commands/sources.js';

describe('listSources', () => {
  it('reports all adapters with implemented flag and session counts', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-src-'));
    const proj = join(home, '.claude', 'projects', '-Users-test-app');
    mkdirSync(proj, { recursive: true });
    writeFileSync(join(proj, 'sess-1.jsonl'), JSON.stringify({ type: 'user', message: { role: 'user', content: 'hello there everyone' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }));
    const rows = listSources({ homeDir: home });
    const claude = rows.find((r) => r.id === 'claude-code')!;
    expect(claude.implemented).toBe(true);
    expect(claude.sessions).toBe(1);
    const codex = rows.find((r) => r.id === 'codex')!;
    expect(codex.implemented).toBe(true);
    expect(codex.sessions).toBe(0);
    const cursor = rows.find((r) => r.id === 'cursor')!;
    expect(cursor.implemented).toBe(false);
    expect(cursor.sessions).toBe(0);
  });
});
