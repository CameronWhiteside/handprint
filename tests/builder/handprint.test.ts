import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Mark, Source } from '@handprint/types';

const TEST_HOME = join(tmpdir(), `handprint-test-builder-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `handprint-test-project-builder-${Date.now()}`);

describe('handprint builder', () => {
  beforeEach(async () => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;

    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    await initGlobal({ handle: 'testuser', name: 'Test', email: 'test@test.com' });
    initProject(TEST_PROJECT);
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  const testMarks: Mark[] = [
    { type: 'choice', subtype: 'override', note: 'Use libsodium instead of node:crypto' },
  ];

  const testSource: Source = {
    agent: 'claude-code/opus-4-8',
    extractor: 'claude-haiku-4-5',
    session: 'abc123',
  };

  it('builds a valid handprint object', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'user said: use libsodium',
    });

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.handprint.v).toBe(1);
    expect(result.handprint.marks).toEqual(testMarks);
    expect(result.handprint.source).toEqual(testSource);
    expect(result.handprint.parent).toBeNull();
    expect(result.handprint.sig.length).toBeGreaterThan(0);
    expect(result.handprint.pubkey.length).toBeGreaterThan(0);
  });

  it('payload is encrypted (not plaintext)', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'this is a secret conversation',
    });

    expect(result.handprint.payload).not.toContain('secret conversation');
  });

  it('chains handprints via parent', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');

    const first = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'first conversation',
    });

    const second = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'Ship v2' }],
      source: testSource,
      plaintext: 'second conversation',
    });

    expect(first.handprint.parent).toBeNull();
    expect(second.handprint.parent).toBe(first.hash);
  });

  it('stores object in .handprint/objects/', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'test',
    });

    const objectsDir = join(TEST_PROJECT, '.handprint', 'objects');
    const prefix = result.hash.slice(0, 2);
    expect(existsSync(join(objectsDir, prefix))).toBe(true);
  });

  it('sanitizes plaintext before encrypting', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { loadSeed } = await import('../../src/dirs/global.js');
    const { deriveEncryptionKey, decrypt } = await import('../../src/crypto/noble.js');

    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'my email is user@example.com and key is SUPER_SECRET_API_KEY',
    });

    const seed = loadSeed();
    const encKey = await deriveEncryptionKey(seed);
    const decrypted = await decrypt(result.handprint.payload, encKey);
    expect(decrypted).toContain('[REDACTED_EMAIL]');
    expect(decrypted).toContain('[REDACTED_KEY]');
    expect(decrypted).not.toContain('user@example.com');
  });

  it('appends hash to log file', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { readFileSync } = await import('node:fs');

    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'test',
    });

    const logPath = join(TEST_PROJECT, '.handprint', 'log');
    const log = readFileSync(logPath, 'utf-8').trim();
    expect(log).toBe(result.hash);
  });
});
