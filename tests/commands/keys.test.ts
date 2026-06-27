import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-keys-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-keys-proj-${Date.now()}`);

describe('key rotation keyring + verify trust anchor', () => {
  beforeEach(async () => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;
    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    await initGlobal({ handle: 'test', name: 'Test', email: 't@t.com' });
    initProject(TEST_PROJECT);
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('rotation archives the old seed and keeps prior payloads decryptable and the chain verifiable', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { keysRotate } = await import('../../src/commands/keys.js');
    const { verifyChain } = await import('../../src/commands/verify.js');
    const { showHandprint } = await import('../../src/commands/show.js');
    const { loadAllSeeds } = await import('../../src/dirs/global.js');

    const first = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'before rotation' }],
      source: { agent: 'test' },
      plaintext: 'secret-before-rotation',
    });

    const rot = await keysRotate();
    expect(rot.previousFingerprint).toBeTruthy();
    expect(loadAllSeeds()).toHaveLength(2); // current + 1 archived

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'after rotation' }],
      source: { agent: 'test' },
      plaintext: 'after-rotation',
    });

    // Both entries verify: old key is still an authorized (archived) identity.
    const result = await verifyChain(TEST_PROJECT);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(2);

    // The pre-rotation payload still decrypts via the archived key.
    const shown = await showHandprint(TEST_PROJECT, first.hash, { decrypt: true });
    expect(shown?.decryptedPayload).toBe('secret-before-rotation');
  });

  it('rejects a chain signed by a key that is not an authorized identity', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { verifyChain } = await import('../../src/commands/verify.js');
    const { generateSeed, toBase64url } = await import('../../src/crypto/sodium.js');
    const { seedFilePath } = await import('../../src/dirs/global.js');

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'mine' }],
      source: { agent: 'test' },
      plaintext: 'mine',
    });

    // Replace the identity with an unrelated seed and no archive: the existing
    // entry's signing key is now foreign and must be rejected.
    const stranger = await generateSeed();
    writeFileSync(seedFilePath(), toBase64url(stranger), { mode: 0o600 });

    const result = await verifyChain(TEST_PROJECT);
    expect(result.valid).toBe(false);
    expect(result.errors[0].error).toBe('unauthorized signing key');
  });

  it('sanitizes secrets out of cleartext mark notes before writing', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { showHandprint } = await import('../../src/commands/show.js');

    const built = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [
        { type: 'choice', subtype: 'constraint', note: 'use key AKIA1234567890ABCD99 for prod' },
      ],
      source: { agent: 'test' },
      plaintext: 'x',
    });

    const shown = await showHandprint(TEST_PROJECT, built.hash);
    expect(shown?.handprint.marks[0].note).not.toContain('AKIA1234567890ABCD99');
    expect(existsSync(TEST_PROJECT)).toBe(true);
  });
});
