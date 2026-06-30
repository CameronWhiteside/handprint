import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reset } from '../../src/commands/reset.js';

let HOME: string;
let PROJECT: string;
let hpDir: string;

beforeEach(async () => {
  HOME = mkdtempSync(join(tmpdir(), 'hp-reset-home-'));
  PROJECT = mkdtempSync(join(tmpdir(), 'hp-reset-proj-'));
  process.env.HANDPRINT_HOME = HOME;
  const { initGlobal } = await import('../../src/dirs/global.js');
  const { initProject, projectDir } = await import('../../src/dirs/project.js');
  await initGlobal({ handle: '@cameronwhiteside', name: 'Cameron', email: 'c@d.e' });
  initProject(PROJECT);
  hpDir = projectDir(PROJECT);
  // simulate a chain: objects, log (2 handprints), grab watermark
  mkdirSync(join(hpDir, 'objects'), { recursive: true });
  writeFileSync(join(hpDir, 'objects', 'aa'), 'x');
  writeFileSync(join(hpDir, 'log'), 'hash1\nhash2\n');
  writeFileSync(join(hpDir, 'grabbed.json'), '{"version":1,"sessions":{}}');
});

afterEach(() => {
  delete process.env.HANDPRINT_HOME;
  rmSync(HOME, { recursive: true, force: true });
  rmSync(PROJECT, { recursive: true, force: true });
});

describe('reset', () => {
  it('requires confirmation: no force and no confirm callback deletes nothing', async () => {
    const res = await reset(PROJECT);
    expect(res.needsConfirm).toBe(true);
    expect(res.confirmed).toBe(false);
    expect(res.plan.handprints).toBe(2);
    expect(existsSync(join(hpDir, 'log'))).toBe(true);
    expect(existsSync(join(hpDir, 'objects'))).toBe(true);
  });

  it('aborts (deletes nothing) when confirm returns false', async () => {
    const res = await reset(PROJECT, { confirm: async () => false });
    expect(res.confirmed).toBe(false);
    expect(res.removed).toBe(0);
    expect(existsSync(join(hpDir, 'log'))).toBe(true);
  });

  it('deletes the chain on confirm, keeping config and identity', async () => {
    const res = await reset(PROJECT, { confirm: async () => true });
    expect(res.confirmed).toBe(true);
    expect(res.removed).toBe(2);
    expect(existsSync(join(hpDir, 'objects'))).toBe(false);
    expect(existsSync(join(hpDir, 'log'))).toBe(false);
    expect(existsSync(join(hpDir, 'grabbed.json'))).toBe(false);
    // project config kept
    expect(existsSync(join(hpDir, 'config.json'))).toBe(true);
    // global identity kept
    expect(existsSync(join(HOME, 'config.json'))).toBe(true);
  });

  it('deletes with --force (no prompt)', async () => {
    const res = await reset(PROJECT, { force: true });
    expect(res.confirmed).toBe(true);
    expect(res.removed).toBe(2);
    expect(existsSync(join(hpDir, 'log'))).toBe(false);
  });

  it('throws when not a handprint project', async () => {
    const bare = mkdtempSync(join(tmpdir(), 'hp-bare-'));
    await expect(reset(bare)).rejects.toThrow(/not a handprint project/);
    rmSync(bare, { recursive: true, force: true });
  });
});
