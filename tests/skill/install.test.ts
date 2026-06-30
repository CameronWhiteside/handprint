import { mkdtempSync, mkdirSync, existsSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import {
  skillSourcePath,
  cliVersion,
  skillTargetDir,
  installSkill,
  uninstallSkill,
  ensureSkillSynced,
} from '../../src/skill/install.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let tmpDirs: string[] = [];

function makeTempDir(): string {
  const d = mkdtempSync(join(tmpdir(), 'handprint-skill-test-'));
  tmpDirs.push(d);
  return d;
}

// ---------------------------------------------------------------------------

describe('skillSourcePath', () => {
  it('points at an existing file', () => {
    const p = skillSourcePath();
    expect(existsSync(p)).toBe(true);
    expect(p).toMatch(/SKILL\.md$/);
  });
});

describe('cliVersion', () => {
  it('returns a semver-like string', () => {
    const v = cliVersion();
    expect(v).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('skillTargetDir', () => {
  it('global scope uses claudeHome', () => {
    const dir = skillTargetDir('global', { claudeHome: '/tmp/fake-claude' });
    expect(dir).toBe('/tmp/fake-claude/skills/handprint');
  });

  it('project scope uses cwd', () => {
    const dir = skillTargetDir('project', { cwd: '/tmp/my-project' });
    expect(dir).toBe('/tmp/my-project/.claude/skills/handprint');
  });
});

describe('installSkill', () => {
  afterEach(() => {
    for (const d of tmpDirs) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
    tmpDirs = [];
  });

  it('writes SKILL.md and .version into the global skill dir', () => {
    const claudeHome = makeTempDir();
    const result = installSkill({ scope: 'global', claudeHome });

    const skillFile = join(claudeHome, 'skills', 'handprint', 'SKILL.md');
    const versionFile = join(claudeHome, 'skills', 'handprint', '.version');

    expect(result.installed).toBe(true);
    expect(result.path).toBe(skillFile);
    expect(existsSync(skillFile)).toBe(true);
    expect(existsSync(versionFile)).toBe(true);

    const recordedVersion = readFileSync(versionFile, 'utf-8').trim();
    expect(recordedVersion).toBe(cliVersion());
    expect(result.version).toBe(cliVersion());
  });

  it('writes SKILL.md into the project skill dir', () => {
    const projectDir = makeTempDir();
    const result = installSkill({ scope: 'project', cwd: projectDir });

    const skillFile = join(projectDir, '.claude', 'skills', 'handprint', 'SKILL.md');
    expect(existsSync(skillFile)).toBe(true);
    expect(result.path).toBe(skillFile);
  });
});

describe('uninstallSkill', () => {
  afterEach(() => {
    for (const d of tmpDirs) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
    tmpDirs = [];
  });

  it('removes the skill directory when present', () => {
    const claudeHome = makeTempDir();
    installSkill({ scope: 'global', claudeHome });

    const targetDir = join(claudeHome, 'skills', 'handprint');
    expect(existsSync(targetDir)).toBe(true);

    const result = uninstallSkill({ scope: 'global', claudeHome });
    expect(result.removed).toBe(true);
    expect(existsSync(targetDir)).toBe(false);
  });

  it('returns removed:false when nothing was installed', () => {
    const claudeHome = makeTempDir();
    const result = uninstallSkill({ scope: 'global', claudeHome });
    expect(result.removed).toBe(false);
  });
});

describe('ensureSkillSynced', () => {
  let savedEnv: string | undefined;

  beforeEach(() => {
    savedEnv = process.env['HANDPRINT_NO_SKILL_SYNC'];
    delete process.env['HANDPRINT_NO_SKILL_SYNC'];
  });

  afterEach(() => {
    if (savedEnv === undefined) {
      delete process.env['HANDPRINT_NO_SKILL_SYNC'];
    } else {
      process.env['HANDPRINT_NO_SKILL_SYNC'] = savedEnv;
    }
    for (const d of tmpDirs) {
      if (existsSync(d)) rmSync(d, { recursive: true, force: true });
    }
    tmpDirs = [];
  });

  it('does nothing when claudeHome does not exist', () => {
    const missing = join(makeTempDir(), 'does-not-exist');
    // Should not throw and should not create the directory
    ensureSkillSynced({ claudeHome: missing });
    expect(existsSync(missing)).toBe(false);
  });

  it('respects HANDPRINT_NO_SKILL_SYNC env var', () => {
    process.env['HANDPRINT_NO_SKILL_SYNC'] = '1';
    const claudeHome = makeTempDir();
    ensureSkillSynced({ claudeHome });
    // Skill should NOT have been installed
    const skillFile = join(claudeHome, 'skills', 'handprint', 'SKILL.md');
    expect(existsSync(skillFile)).toBe(false);
  });

  it('installs the skill when SKILL.md is missing', () => {
    const claudeHome = makeTempDir();
    // claudeHome exists but skill has never been installed
    ensureSkillSynced({ claudeHome });
    const skillFile = join(claudeHome, 'skills', 'handprint', 'SKILL.md');
    expect(existsSync(skillFile)).toBe(true);
  });

  it('is a no-op when version already matches (does not overwrite)', () => {
    const claudeHome = makeTempDir();
    // Install correctly first
    installSkill({ scope: 'global', claudeHome });

    // Corrupt SKILL.md content, but keep .version matching
    const targetDir = join(claudeHome, 'skills', 'handprint');
    const skillFile = join(targetDir, 'SKILL.md');
    writeFileSync(skillFile, 'CORRUPTED', 'utf-8');

    // ensureSkillSynced should be a no-op because version matches
    ensureSkillSynced({ claudeHome });

    // File should still be corrupted (no reinstall)
    expect(readFileSync(skillFile, 'utf-8')).toBe('CORRUPTED');
  });

  it('reinstalls when .version does not match', () => {
    const claudeHome = makeTempDir();
    installSkill({ scope: 'global', claudeHome });

    const targetDir = join(claudeHome, 'skills', 'handprint');
    const versionFile = join(targetDir, '.version');
    const skillFile = join(targetDir, 'SKILL.md');

    // Write an older version to trigger reinstall
    writeFileSync(versionFile, '0.0.0', 'utf-8');
    writeFileSync(skillFile, 'CORRUPTED', 'utf-8');

    ensureSkillSynced({ claudeHome });

    // File should now be restored to real SKILL.md content
    const content = readFileSync(skillFile, 'utf-8');
    expect(content).not.toBe('CORRUPTED');
    expect(content.length).toBeGreaterThan(10);

    // Version file should now match CLI version
    expect(readFileSync(versionFile, 'utf-8').trim()).toBe(cliVersion());
  });

  it('creates skill dir inside an existing claudeHome', () => {
    const claudeHome = makeTempDir();
    // Pre-create only claudeHome (no skills subdir yet)
    mkdirSync(claudeHome, { recursive: true });

    ensureSkillSynced({ claudeHome });

    const skillFile = join(claudeHome, 'skills', 'handprint', 'SKILL.md');
    expect(existsSync(skillFile)).toBe(true);
  });
});
