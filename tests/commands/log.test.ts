import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-log-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-log-proj-${Date.now()}`);

describe('listHandprints', () => {
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

  it('returns empty array when no handprints exist', async () => {
    const { listHandprints } = await import('../../src/commands/log.js');
    const entries = listHandprints(TEST_PROJECT);
    expect(entries).toEqual([]);
  });

  it('returns all handprint entries in order', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { listHandprints } = await import('../../src/commands/log.js');

    const { hash: hash1 } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'first' }],
      source: { agent: 'test' },
      plaintext: 'first',
    });

    const { hash: hash2 } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'second' }],
      source: { agent: 'test' },
      plaintext: 'second',
    });

    const entries = listHandprints(TEST_PROJECT);
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe(hash1);
    expect(entries[1].hash).toBe(hash2);
  });

  it('each entry includes hash and handprint data', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { listHandprints } = await import('../../src/commands/log.js');

    const { hash } = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'test' }],
      source: { agent: 'test-agent' },
      plaintext: 'test plaintext',
    });

    const entries = listHandprints(TEST_PROJECT);
    expect(entries).toHaveLength(1);
    expect(entries[0].hash).toBe(hash);
    expect(entries[0].handprint.source.agent).toBe('test-agent');
    expect(entries[0].handprint.marks[0].type).toBe('choice');
  });

  it('filters by mark type', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { listHandprints } = await import('../../src/commands/log.js');

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'vision one' }],
      source: { agent: 'test' },
      plaintext: 'vision',
    });

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'choice one' }],
      source: { agent: 'test' },
      plaintext: 'choice',
    });

    const choices = listHandprints(TEST_PROJECT, { type: 'choice' });
    expect(choices).toHaveLength(1);
    expect(choices[0].handprint.marks[0].type).toBe('choice');
  });

  it('respects limit option', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { listHandprints } = await import('../../src/commands/log.js');

    for (let i = 0; i < 3; i++) {
      await buildHandprint({
        projectRoot: TEST_PROJECT,
        marks: [{ type: 'choice', subtype: 'override', note: `entry ${i}` }],
        source: { agent: 'test' },
        plaintext: `entry ${i}`,
      });
    }

    const limited = listHandprints(TEST_PROJECT, { limit: 2 });
    expect(limited).toHaveLength(2);
  });
});
