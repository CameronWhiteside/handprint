import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-show-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-show-proj-${Date.now()}`);

describe('showHandprint', () => {
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

  it('returns full handprint by hash', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { showHandprint } = await import('../../src/commands/show.js');

    const { hash } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'test' }],
      source: { agent: 'test-agent' },
      plaintext: 'build an auth service',
    });

    const detail = await showHandprint(TEST_PROJECT, hash);
    expect(detail).not.toBeNull();
    expect(detail!.hash).toBe(hash);
    expect(detail!.handprint.source.agent).toBe('test-agent');
    expect(detail!.handprint.marks[0].type).toBe('choice');
  });

  it('resolves short hash prefix (min 7 chars)', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { showHandprint } = await import('../../src/commands/show.js');

    const { hash } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'test' }],
      source: { agent: 'test' },
      plaintext: 'some plaintext',
    });

    const shortRef = hash.slice(0, 7);
    const detail = await showHandprint(TEST_PROJECT, shortRef);
    expect(detail).not.toBeNull();
    expect(detail!.hash).toBe(hash);
  });

  it('returns null for unknown hash', async () => {
    const { showHandprint } = await import('../../src/commands/show.js');
    const detail = await showHandprint(
      TEST_PROJECT,
      'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
    );
    expect(detail).toBeNull();
  });

  it('decrypts payload when requested', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { showHandprint } = await import('../../src/commands/show.js');

    const { hash } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'test' }],
      source: { agent: 'test' },
      plaintext: 'build an auth service for the app',
    });

    const detail = await showHandprint(TEST_PROJECT, hash, { decrypt: true });
    expect(detail).not.toBeNull();
    expect(detail!.decryptedPayload).toBeDefined();
    expect(detail!.decryptedPayload).toContain('auth service');
  });

  it('does not decrypt by default', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { showHandprint } = await import('../../src/commands/show.js');

    const { hash } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'test' }],
      source: { agent: 'test' },
      plaintext: 'some text',
    });

    const detail = await showHandprint(TEST_PROJECT, hash);
    expect(detail).not.toBeNull();
    expect(detail!.decryptedPayload).toBeUndefined();
  });
});
