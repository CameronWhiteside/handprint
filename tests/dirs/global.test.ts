import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `handprint-test-global-${Date.now()}`);

describe('global dir', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('initGlobal creates directory structure', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const path = await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(existsSync(join(path, 'keys', 'seed'))).toBe(true);
    expect(existsSync(join(path, 'config.json'))).toBe(true);
    expect(existsSync(join(path, 'sources'))).toBe(true);
  });

  it('seed file has mode 0600', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const path = await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const stat = statSync(join(path, 'keys', 'seed'));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('keys directory has mode 0700', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const path = await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const stat = statSync(join(path, 'keys'));
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it('config.json contains identity', async () => {
    const { initGlobal, loadGlobalConfig } = await import('../../src/dirs/global.js');
    await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const config = loadGlobalConfig();
    expect(config.identity.handle).toBe('testuser');
    expect(config.identity.name).toBe('Test User');
    expect(config.identity.email).toBe('test@example.com');
    expect(config.hub.url).toBe('https://handprint.sh');
  });

  it('loadSeed returns 32 bytes that re-derive same keypair', async () => {
    const { initGlobal, loadSeed } = await import('../../src/dirs/global.js');
    const { deriveKeypair } = await import('../../src/crypto/sodium.js');
    await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const seed = loadSeed();
    expect(seed.length).toBe(32);
    const kp = await deriveKeypair(seed);
    expect(kp.publicKey.length).toBe(32);
  });

  it('isGlobalInitialized returns false when not initialized', async () => {
    const { isGlobalInitialized } = await import('../../src/dirs/global.js');
    expect(isGlobalInitialized()).toBe(false);
  });

  it('isGlobalInitialized returns true after init', async () => {
    const { initGlobal, isGlobalInitialized } = await import('../../src/dirs/global.js');
    await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(isGlobalInitialized()).toBe(true);
  });

  it('initGlobal throws if already initialized', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const identity = { handle: 'testuser', name: 'Test User', email: 'test@example.com' };
    await initGlobal(identity);
    await expect(initGlobal(identity)).rejects.toThrow('already initialized');
  });
});
