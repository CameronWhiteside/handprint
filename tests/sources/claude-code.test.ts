// tests/sources/claude-code.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeCodeAdapter, parseClaudeLine } from '../../src/sources/claude-code.js';
import type { SessionRef } from '../../src/sources/types.js';

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-claude-'));
  const proj = join(home, '.claude', 'projects', '-Users-test-app');
  mkdirSync(proj, { recursive: true });
  const lines = [
    JSON.stringify({ type: 'user', message: { role: 'user', content: 'use edge JWT instead of the gateway' }, timestamp: '2026-06-01T10:00:00Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
    JSON.stringify({ type: 'assistant', message: { role: 'assistant', content: [{ type: 'text', text: 'Okay, switching to edge JWT.' }] }, timestamp: '2026-06-01T10:00:05Z', cwd: '/Users/test/app', sessionId: 'sess-1', gitBranch: 'main' }),
  ].join('\n');
  writeFileSync(join(proj, 'sess-1.jsonl'), lines);
  return home;
}

const fakeRef: SessionRef = { sourceId: 'claude-code', sessionId: 'sess-x', project: 'p', locator: '', mtimeMs: 0 };

describe('claude-code adapter', () => {
  it('descriptor reports claude-code + iso timestamps', () => {
    expect(claudeCodeAdapter.descriptor.id).toBe('claude-code');
    expect(claudeCodeAdapter.descriptor.sourceAgent).toBe('claude-code');
    expect(claudeCodeAdapter.descriptor.capabilities.timestamps).toBe('iso');
    expect(claudeCodeAdapter.descriptor.implemented).toBe(true);
  });

  it('locates sessions under ~/.claude/projects', () => {
    const home = fixtureHome();
    const refs = claudeCodeAdapter.locate({ homeDir: home });
    expect(refs).toHaveLength(1);
    expect(refs[0].sessionId).toBe('sess-1');
    expect(refs[0].sourceId).toBe('claude-code');
  });

  it('parses a session into normalized entries', () => {
    const home = fixtureHome();
    const ref = claudeCodeAdapter.locate({ homeDir: home })[0];
    const session = claudeCodeAdapter.parse(ref);
    expect(session.entries).toHaveLength(2);
    expect(session.entries[0].role).toBe('user');
    expect(session.entries[0].text).toContain('edge JWT');
    expect(session.entries[1].text).toContain('switching to edge JWT');
    expect(session.entries[0].timestamp).toBe('2026-06-01T10:00:00Z');
  });

  it('parseClaudeLine returns null for a line with tool_result content', () => {
    const line = JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'x', content: 'result' }] }, timestamp: 't' });
    expect(parseClaudeLine(line, fakeRef)).toBeNull();
  });

  it('parseClaudeLine returns null for a non user/assistant type', () => {
    const line = JSON.stringify({ type: 'mode', message: { role: 'user', content: 'hello' }, timestamp: 't' });
    expect(parseClaudeLine(line, fakeRef)).toBeNull();
  });

  it('parseClaudeLine returns null for invalid JSON', () => {
    expect(parseClaudeLine('{not valid json', fakeRef)).toBeNull();
  });
});
