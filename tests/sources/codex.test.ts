// tests/sources/codex.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { codexAdapter, entryFromLine, extractPatchPaths } from '../../src/sources/codex.js';
import type { SessionRef } from '../../src/sources/types.js';

const PATCH = '*** Begin Patch\n*** Add File: src/new.ts\n+export {};\n*** Update File: /abs/other.ts\n+x\n*** End Patch';

function sessionLines(): string {
  return [
    JSON.stringify({ timestamp: '2026-06-11T10:23:49.100Z', type: 'session_meta', payload: { id: 'sess-codex-1', timestamp: '2026-06-11T10:19:50.307Z', cwd: '/Users/test/app', originator: 'codex-tui', cli_version: '0.139.0' } }),
    JSON.stringify({ timestamp: '2026-06-11T10:23:49.121Z', type: 'response_item', payload: { type: 'message', role: 'developer', content: [{ type: 'input_text', text: '<permissions instructions>...' }] } }),
    JSON.stringify({ timestamp: '2026-06-11T10:23:49.127Z', type: 'event_msg', payload: { type: 'user_message', message: 'use edge JWT instead of the gateway' } }),
    JSON.stringify({ timestamp: '2026-06-11T10:23:49.130Z', type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text: 'use edge JWT instead of the gateway' }] } }),
    JSON.stringify({ timestamp: '2026-06-11T10:23:57.098Z', type: 'event_msg', payload: { type: 'agent_message', message: 'Okay, switching to edge JWT.' } }),
    JSON.stringify({ timestamp: '2026-06-11T10:23:57.100Z', type: 'response_item', payload: { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'Okay, switching to edge JWT.' }] } }),
    JSON.stringify({ timestamp: '2026-06-11T10:26:31.605Z', type: 'response_item', payload: { type: 'custom_tool_call', status: 'completed', call_id: 'call_1', name: 'apply_patch', input: PATCH } }),
    JSON.stringify({ timestamp: '2026-06-11T10:26:40.000Z', type: 'event_msg', payload: { type: 'token_count', info: {} } }),
    JSON.stringify({ timestamp: '2026-06-11T10:26:41.000Z', type: 'event_msg', payload: { type: 'user_message', message: '   \n  ' } }),
    '{not valid json',
    '',
  ].join('\n');
}

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-codex-'));
  const day = join(home, '.codex', 'sessions', '2026', '06', '11');
  mkdirSync(day, { recursive: true });
  writeFileSync(join(day, 'rollout-2026-06-11T15-49-50-sess-codex-1.jsonl'), sessionLines());
  return home;
}

describe('codex adapter', () => {
  it('descriptor reports codex + iso timestamps, implemented', () => {
    expect(codexAdapter.descriptor.id).toBe('codex');
    expect(codexAdapter.descriptor.sourceAgent).toBe('codex');
    expect(codexAdapter.descriptor.capabilities.timestamps).toBe('iso');
    expect(codexAdapter.descriptor.implemented).toBe(true);
  });

  it('locates sessions under ~/.codex/sessions with id + project from session_meta', () => {
    const home = fixtureHome();
    const refs = codexAdapter.locate({ homeDir: home });
    expect(refs).toHaveLength(1);
    expect(refs[0].sourceId).toBe('codex');
    expect(refs[0].sessionId).toBe('sess-codex-1');
    expect(refs[0].project).toBe('~/test/app');
    expect(refs[0].mtimeMs).toBeGreaterThan(0);
  });

  it('locate returns [] when ~/.codex/sessions is absent', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-codex-empty-'));
    expect(codexAdapter.locate({ homeDir: home })).toEqual([]);
  });

  it('locate skips subagent threads (their user turns are agent prompts)', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-codex-sub-'));
    const day = join(home, '.codex', 'sessions', '2026', '06', '11');
    mkdirSync(day, { recursive: true });
    writeFileSync(
      join(day, 'rollout-sub.jsonl'),
      JSON.stringify({ timestamp: 't', type: 'session_meta', payload: { id: 'sub-1', cwd: '/Users/test/app', thread_source: 'subagent', parent_thread_id: 'parent-1' } }) + '\n',
    );
    expect(codexAdapter.locate({ homeDir: home })).toEqual([]);
  });

  it('locate falls back to the filename when session_meta is unreadable', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-codex-meta-'));
    const day = join(home, '.codex', 'sessions', '2026', '06', '11');
    mkdirSync(day, { recursive: true });
    writeFileSync(join(day, 'rollout-broken.jsonl'), '{not valid json\n');
    const refs = codexAdapter.locate({ homeDir: home });
    expect(refs).toHaveLength(1);
    expect(refs[0].sessionId).toBe('rollout-broken');
    expect(refs[0].project).toBe('(unknown)');
  });

  it('parses event_msg turns and skips response_item mirrors and noise', () => {
    const home = fixtureHome();
    const ref = codexAdapter.locate({ homeDir: home })[0];
    const session = codexAdapter.parse(ref);
    const talk = session.entries.filter((e) => e.text);
    expect(talk).toHaveLength(2);
    expect(talk[0].role).toBe('user');
    expect(talk[0].text).toContain('edge JWT');
    expect(talk[0].timestamp).toBe('2026-06-11T10:23:49.127Z');
    expect(talk[0].cwd).toBe('/Users/test/app');
    expect(talk[0].sessionId).toBe('sess-codex-1');
    expect(talk[1].role).toBe('assistant');
    expect(talk[1].text).toContain('switching to edge JWT');
  });

  it('captures apply_patch file paths resolved against the session cwd', () => {
    const home = fixtureHome();
    const ref = codexAdapter.locate({ homeDir: home })[0];
    const session = codexAdapter.parse(ref);
    const patched = session.entries.filter((e) => e.paths);
    expect(patched).toHaveLength(1);
    expect(patched[0].role).toBe('assistant');
    expect(patched[0].text).toBe('');
    expect(patched[0].paths).toEqual(['/Users/test/app/src/new.ts', '/abs/other.ts']);
  });

  it('tracks cwd changes from turn_context for later patches', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-codex-cwd-'));
    const day = join(home, '.codex', 'sessions', '2026', '07', '01');
    mkdirSync(day, { recursive: true });
    const lines = [
      JSON.stringify({ timestamp: 't1', type: 'session_meta', payload: { id: 's2', cwd: '/Users/test/app' } }),
      JSON.stringify({ timestamp: 't2', type: 'turn_context', payload: { turn_id: 'turn-1', cwd: '/Users/test/other' } }),
      JSON.stringify({ timestamp: 't3', type: 'response_item', payload: { type: 'custom_tool_call', name: 'apply_patch', input: '*** Update File: lib/y.ts' } }),
    ].join('\n');
    writeFileSync(join(day, 'rollout-s2.jsonl'), lines);
    const ref = codexAdapter.locate({ homeDir: home })[0];
    const session = codexAdapter.parse(ref);
    expect(session.entries).toHaveLength(1);
    expect(session.entries[0].paths).toEqual(['/Users/test/other/lib/y.ts']);
    expect(session.entries[0].cwd).toBe('/Users/test/other');
  });

  it('reads apply_patch from the function_call form too', () => {
    const home = mkdtempSync(join(tmpdir(), 'hp-codex-fc-'));
    const day = join(home, '.codex', 'sessions', '2026', '07', '01');
    mkdirSync(day, { recursive: true });
    const lines = [
      JSON.stringify({ timestamp: 't1', type: 'session_meta', payload: { id: 's3', cwd: '/Users/test/app' } }),
      JSON.stringify({ timestamp: 't2', type: 'response_item', payload: { type: 'function_call', name: 'apply_patch', arguments: JSON.stringify({ input: '*** Add File: a.ts' }), call_id: 'c1' } }),
    ].join('\n');
    writeFileSync(join(day, 'rollout-s3.jsonl'), lines);
    const ref = codexAdapter.locate({ homeDir: home })[0];
    const session = codexAdapter.parse(ref);
    expect(session.entries).toHaveLength(1);
    expect(session.entries[0].paths).toEqual(['/Users/test/app/a.ts']);
  });

  it('parse returns no entries for an unreadable locator', () => {
    const ref = { sourceId: 'codex', sessionId: 'x', project: 'p', locator: '/nonexistent/file.jsonl', mtimeMs: 0 };
    expect(codexAdapter.parse(ref).entries).toEqual([]);
  });

  it('entryFromLine returns null for non-conversation lines', () => {
    const fakeRef: SessionRef = { sourceId: 'codex', sessionId: 's', project: 'p', locator: '', mtimeMs: 0 };
    expect(entryFromLine({ type: 'event_msg', payload: { type: 'token_count', info: {} } }, '/a', fakeRef)).toBeNull();
    expect(entryFromLine({ type: 'event_msg', payload: { type: 'user_message', message: '   ' } }, '/a', fakeRef)).toBeNull();
    expect(entryFromLine({ type: 'response_item', payload: { type: 'message', role: 'assistant', content: [] } }, '/a', fakeRef)).toBeNull();
    expect(entryFromLine({ type: 'event_msg' }, '/a', fakeRef)).toBeNull();
  });

  it('entryFromLine builds a user entry from an event_msg user_message', () => {
    const fakeRef: SessionRef = { sourceId: 'codex', sessionId: 's', project: 'p', locator: '', mtimeMs: 0 };
    const entry = entryFromLine(
      { timestamp: '2026-06-11T10:00:00Z', type: 'event_msg', payload: { type: 'user_message', message: 'ship it' } },
      '/repo',
      fakeRef,
    );
    expect(entry).toEqual({ role: 'user', text: 'ship it', timestamp: '2026-06-11T10:00:00Z', cwd: '/repo', sessionId: 's', gitBranch: '' });
  });

  it('extractPatchPaths handles Add/Update/Delete and skips empty cwd for relative paths', () => {
    const input = '*** Begin Patch\n*** Add File: a.ts\n*** Update File: b/c.ts\n*** Delete File: /abs/d.ts\n*** End Patch';
    expect(extractPatchPaths(input, '/repo')).toEqual(['/repo/a.ts', '/repo/b/c.ts', '/abs/d.ts']);
    expect(extractPatchPaths(input, '')).toEqual(['/abs/d.ts']);
  });
});
