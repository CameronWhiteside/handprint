import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hook } from '../../src/commands/hook.js';

let HOME: string;

beforeEach(() => {
  HOME = mkdtempSync(join(tmpdir(), 'hp-hook-'));
  process.env.HANDPRINT_HOME = HOME; // globalDir() → this dir
});

afterEach(() => {
  delete process.env.HANDPRINT_HOME;
  rmSync(HOME, { recursive: true, force: true });
});

describe('hook', () => {
  it('runs and stamps when no prior run exists', () => {
    let launchedRoot = '';
    const r = hook({ now: 1000, root: '/tmp/root', launch: (root) => (launchedRoot = root) });
    expect(r).toEqual({ ran: true, reason: 'spawned' });
    expect(launchedRoot).toBe('/tmp/root');
    expect(readFileSync(join(HOME, '.hook-last'), 'utf-8')).toBe('1000');
  });

  it('debounces a second call inside the interval', () => {
    writeFileSync(join(HOME, '.hook-last'), '1000', 'utf-8');
    let launched = false;
    const r = hook({ now: 1000 + 60_000, intervalSeconds: 900, launch: () => (launched = true) });
    expect(r).toEqual({ ran: false, reason: 'debounced' });
    expect(launched).toBe(false);
  });

  it('runs again once the interval has elapsed', () => {
    writeFileSync(join(HOME, '.hook-last'), '1000', 'utf-8');
    let launched = false;
    const r = hook({ now: 1000 + 901_000, intervalSeconds: 900, launch: () => (launched = true) });
    expect(r).toEqual({ ran: true, reason: 'spawned' });
    expect(launched).toBe(true);
  });
});
