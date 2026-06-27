// tests/sources/opencode.test.ts
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { opencodeAdapter } from '../../src/sources/opencode.js';

function fixtureHome(): string {
  const home = mkdtempSync(join(tmpdir(), 'hp-oc-'));
  const base = join(home, '.local', 'share', 'opencode', 'storage');
  const sid = 'ses_test1';
  mkdirSync(join(base, 'session'), { recursive: true });
  writeFileSync(join(base, 'session', `${sid}.json`), JSON.stringify({ id: sid, directory: '/Users/test/moon', title: 'Arch', time: { created: 1769485100000 } }));

  const mDir = join(base, 'message', sid);
  mkdirSync(mDir, { recursive: true });
  writeFileSync(join(mDir, 'msg_a.json'), JSON.stringify({ id: 'msg_a', sessionID: sid, role: 'user', time: { created: 1769485100000 }, path: { cwd: '/Users/test/moon' } }));
  writeFileSync(join(mDir, 'msg_b.json'), JSON.stringify({ id: 'msg_b', sessionID: sid, role: 'assistant', time: { created: 1769485102000 }, path: { cwd: '/Users/test/moon' } }));

  const pa = join(base, 'part', 'msg_a');
  mkdirSync(pa, { recursive: true });
  writeFileSync(join(pa, 'prt_1.json'), JSON.stringify({ id: 'prt_1', type: 'text', text: 'use drizzle not prisma' }));
  const pb = join(base, 'part', 'msg_b');
  mkdirSync(pb, { recursive: true });
  writeFileSync(join(pb, 'prt_2.json'), JSON.stringify({ id: 'prt_2', type: 'reasoning', text: 'thinking...' }));
  writeFileSync(join(pb, 'prt_3.json'), JSON.stringify({ id: 'prt_3', type: 'text', text: 'Got it, using drizzle.' }));
  return home;
}

describe('opencode adapter', () => {
  it('descriptor reports opencode + epoch-ms', () => {
    expect(opencodeAdapter.descriptor.id).toBe('opencode');
    expect(opencodeAdapter.descriptor.sourceAgent).toBe('opencode');
    expect(opencodeAdapter.descriptor.capabilities.timestamps).toBe('epoch-ms');
    expect(opencodeAdapter.descriptor.implemented).toBe(true);
  });

  it('locates sessions and reads project from directory', () => {
    const refs = opencodeAdapter.locate({ homeDir: fixtureHome() });
    expect(refs).toHaveLength(1);
    expect(refs[0].sessionId).toBe('ses_test1');
    expect(refs[0].project).toContain('moon');
  });

  it('parses messages by joining text parts in time order, dropping non-text parts', () => {
    const home = fixtureHome();
    const ref = opencodeAdapter.locate({ homeDir: home })[0];
    const session = opencodeAdapter.parse(ref);
    expect(session.entries).toHaveLength(2);
    expect(session.entries[0].role).toBe('user');
    expect(session.entries[0].text).toBe('use drizzle not prisma');
    expect(session.entries[1].text).toBe('Got it, using drizzle.');
    expect(session.entries[1].text).not.toContain('thinking');
    expect(session.entries[0].timestamp).toBe(new Date(1769485100000).toISOString());
  });
});
