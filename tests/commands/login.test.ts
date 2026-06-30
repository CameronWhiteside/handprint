import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { login } from '../../src/commands/login.js';
import type { HubClient } from '../../src/hub/client.js';

let HOME: string;

const fakeClient = (overrides: Partial<HubClient> = {}): HubClient => ({
  pushHandprint: async () => ({ ok: true }),
  registerKey: async () => ({ ok: true }),
  deviceCodeStart: async () => ({
    deviceCode: 'dev-code',
    userCode: 'WXYZ',
    verificationUrl: 'https://handprint.sh/auth/device',
    expiresIn: 900,
    interval: 0,
  }),
  deviceCodePoll: async () => ({ accessToken: 'tok-123' }),
  ...overrides,
});

beforeEach(async () => {
  HOME = mkdtempSync(join(tmpdir(), 'hp-login-'));
  process.env.HANDPRINT_HOME = HOME;
  const { initGlobal } = await import('../../src/dirs/global.js');
  await initGlobal({ handle: '@cameronwhiteside', name: 'Cameron', email: 'c@d.e' });
});

afterEach(() => {
  delete process.env.HANDPRINT_HOME;
  rmSync(HOME, { recursive: true, force: true });
});

describe('login (loopback)', () => {
  it('opens GitHub auth with the userCode in state and never asks for a code', async () => {
    let openedUrl = '';
    const open = (url: string) => {
      openedUrl = url;
      // simulate the browser completing OAuth -> API redirecting to the loopback
      const u = new URL(url);
      const state = decodeURIComponent(u.searchParams.get('state') ?? '');
      const [, , port, nonce] = state.split(':');
      if (port && nonce) {
        void fetch(`http://127.0.0.1:${port}/callback?ok=1&state=${nonce}`).catch(() => {});
      }
    };
    const res = await login({ open, client: fakeClient(), log: () => {}, timeoutMs: 5000 });
    expect(res.handle).toBe('@cameronwhiteside');
    // userCode rides in the state; the URL targets the GitHub login route.
    expect(openedUrl).toContain('/api/auth/login/github');
    expect(decodeURIComponent(openedUrl)).toContain('state=device:WXYZ');
    // token persisted
    const cred = JSON.parse(readFileSync(join(HOME, 'credentials.json'), 'utf-8'));
    expect(cred.accessToken).toBe('tok-123');
  });

  it('still succeeds via polling when the loopback is never hit (e.g. remote)', async () => {
    const res = await login({ open: () => {}, client: fakeClient(), log: () => {}, timeoutMs: 5000 });
    expect(res.handle).toBe('@cameronwhiteside');
    expect(existsSync(join(HOME, 'credentials.json'))).toBe(true);
  });

  it('times out cleanly when authorization never completes', async () => {
    const never = fakeClient({ deviceCodePoll: async () => null });
    await expect(login({ open: () => {}, client: never, log: () => {}, timeoutMs: 300 })).rejects.toThrow(/timed out/);
  });
});
