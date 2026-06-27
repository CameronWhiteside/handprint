import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-status-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-status-proj-${Date.now()}`);

describe('status', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('reports not initialized', async () => {
    const { status } = await import('../../src/commands/status.js');
    const result = await status(TEST_PROJECT);
    expect(result.globalInitialized).toBe(false);
    expect(result.projectInitialized).toBe(false);
  });

  it('reports initialized with fingerprint', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    const { status } = await import('../../src/commands/status.js');

    await initGlobal({ handle: 'test', name: 'Test', email: 't@t.com' });
    initProject(TEST_PROJECT);

    const result = await status(TEST_PROJECT);
    expect(result.globalInitialized).toBe(true);
    expect(result.projectInitialized).toBe(true);
    expect(result.handle).toBe('test');
    expect(result.fingerprint).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(result.visibility).toBe('private');
    expect(result.chainLength).toBe(0);
  });

  it('reports chain length after building handprints', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { status } = await import('../../src/commands/status.js');

    await initGlobal({ handle: 'test', name: 'Test', email: 't@t.com' });
    initProject(TEST_PROJECT);

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'test' }],
      source: { agent: 'test' },
      plaintext: 'test',
    });

    const result = await status(TEST_PROJECT);
    expect(result.chainLength).toBe(1);
    expect(result.chainHead).toMatch(/^[a-f0-9]{64}$/);
  });
});
