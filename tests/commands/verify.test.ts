import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-verify-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-verify-proj-${Date.now()}`);

describe('verifyChain', () => {
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

  it('returns valid for empty chain', async () => {
    const { verifyChain } = await import('../../src/commands/verify.js');
    const result = await verifyChain(TEST_PROJECT);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(0);
  });

  it('verifies a chain of two handprints', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { verifyChain } = await import('../../src/commands/verify.js');

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'first' }],
      source: { agent: 'test' },
      plaintext: 'first',
    });

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'second' }],
      source: { agent: 'test' },
      plaintext: 'second',
    });

    const result = await verifyChain(TEST_PROJECT);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(2);
  });
});
