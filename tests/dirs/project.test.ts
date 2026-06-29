import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), `handprint-test-project-${Date.now()}`);

describe('project dir', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('initProject creates directory structure', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    const path = initProject(TEST_DIR);
    expect(existsSync(join(path, 'config.json'))).toBe(true);
    expect(existsSync(join(path, 'objects'))).toBe(true);
    expect(existsSync(join(path, 'refs'))).toBe(true);
    expect(existsSync(join(path, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(path, '.gitignore'))).toBe(true);
  });

  it('config.json has no visibility field', async () => {
    const { initProject, loadProjectConfig } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    const config = loadProjectConfig(TEST_DIR);
    expect('visibility' in config).toBe(false);
  });

  it('AGENTS.md contains correct content', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    const path = initProject(TEST_DIR);
    const content = readFileSync(join(path, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('handprint grab');
    expect(content).toContain('@handprint-sh/types');
  });

  it('.gitignore tracks config and AGENTS.md, ignores objects/refs/log', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    const path = initProject(TEST_DIR);
    const content = readFileSync(join(path, '.gitignore'), 'utf-8');
    expect(content).toContain('objects/');
    expect(content).toContain('refs/');
    expect(content).toContain('log');
    expect(content).toContain('!config.json');
    expect(content).toContain('!AGENTS.md');
  });

  it('initProject throws if already initialized', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    expect(() => initProject(TEST_DIR)).toThrow('already initialized');
  });

  it('isProjectInitialized returns false when not initialized', async () => {
    const { isProjectInitialized } = await import('../../src/dirs/project.js');
    expect(isProjectInitialized(TEST_DIR)).toBe(false);
  });

  it('isProjectInitialized returns true after init', async () => {
    const { initProject, isProjectInitialized } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    expect(isProjectInitialized(TEST_DIR)).toBe(true);
  });

  it('findProjectRoot walks up to find .handprint', async () => {
    const { initProject, findProjectRoot } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    const subdir = join(TEST_DIR, 'src', 'deep');
    mkdirSync(subdir, { recursive: true });
    expect(findProjectRoot(subdir)).toBe(TEST_DIR);
  });

  it('findProjectRoot returns null when not found', async () => {
    const { findProjectRoot } = await import('../../src/dirs/project.js');
    expect(findProjectRoot(TEST_DIR)).toBeNull();
  });
});
