/**
 * Manages the bundled /handprint Claude Code skill.
 *
 * All functions take injectable base directories so tests can run without
 * touching the real ~/.claude.
 */

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Resolve the bundled SKILL.md from the package.
 *
 * Works in both dev (src/skill/) and the tsup bundle (dist/bin/):
 * both resolve `../../` to the repo / package root.
 */
export function skillSourcePath(): string {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const path = join(root, 'skills', 'handprint', 'SKILL.md');
  if (!existsSync(path)) {
    throw new Error(`Bundled skill not found at ${path}`);
  }
  return path;
}

/**
 * Read the `version` field from the package.json at the package root.
 * Throws if the file is missing or malformed.
 */
export function cliVersion(): string {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const pkgPath = join(root, 'package.json');
  const raw: unknown = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  if (!isRecord(raw) || typeof raw['version'] !== 'string') {
    throw new Error(`Cannot read version from ${pkgPath}`);
  }
  return raw['version'];
}

/**
 * Return the target directory for the skill given scope.
 *
 * - global: `<claudeHome>/skills/handprint` (claudeHome defaults to `~/.claude`)
 * - project: `<cwd>/.claude/skills/handprint`
 */
export function skillTargetDir(
  scope: 'global' | 'project',
  opts?: { claudeHome?: string; cwd?: string },
): string {
  if (scope === 'global') {
    const claudeHome = opts?.claudeHome ?? join(homedir(), '.claude');
    return join(claudeHome, 'skills', 'handprint');
  }
  return join(opts?.cwd ?? process.cwd(), '.claude', 'skills', 'handprint');
}

// ---------------------------------------------------------------------------
// Install / uninstall
// ---------------------------------------------------------------------------

export interface InstallResult {
  installed: boolean;
  path: string;
  version: string;
}

/**
 * Install (or overwrite) the bundled SKILL.md into the target directory.
 * Also writes a `.version` file so `ensureSkillSynced` can detect stale copies.
 */
export function installSkill(opts: {
  scope: 'global' | 'project';
  force?: boolean;
  claudeHome?: string;
  cwd?: string;
}): InstallResult {
  const targetDir = skillTargetDir(opts.scope, {
    claudeHome: opts.claudeHome,
    cwd: opts.cwd,
  });

  mkdirSync(targetDir, { recursive: true });
  copyFileSync(skillSourcePath(), join(targetDir, 'SKILL.md'));

  const version = cliVersion();
  writeFileSync(join(targetDir, '.version'), version, 'utf-8');

  return { installed: true, path: join(targetDir, 'SKILL.md'), version };
}

export interface UninstallResult {
  removed: boolean;
  path: string;
}

/**
 * Remove the skill directory if it exists.
 */
export function uninstallSkill(opts: {
  scope: 'global' | 'project';
  claudeHome?: string;
  cwd?: string;
}): UninstallResult {
  const targetDir = skillTargetDir(opts.scope, {
    claudeHome: opts.claudeHome,
    cwd: opts.cwd,
  });

  const removed = existsSync(targetDir);
  if (removed) {
    rmSync(targetDir, { recursive: true, force: true });
  }

  return { removed, path: targetDir };
}

// ---------------------------------------------------------------------------
// Auto-resync
// ---------------------------------------------------------------------------

/**
 * Silently keep the global skill installation up to date.
 *
 * Rules:
 * - Skipped when HANDPRINT_NO_SKILL_SYNC is set.
 * - Skipped when claudeHome does not exist (never create ~/.claude implicitly).
 * - Copies the skill only when SKILL.md is missing or the recorded version
 *   differs from the current CLI version.
 * - Any error is swallowed — this must never break a normal command.
 */
export function ensureSkillSynced(opts?: { claudeHome?: string }): void {
  try {
    if (process.env['HANDPRINT_NO_SKILL_SYNC']) return;

    const claudeHome = opts?.claudeHome ?? join(homedir(), '.claude');
    if (!existsSync(claudeHome)) return;

    const targetDir = skillTargetDir('global', { claudeHome });
    const skillFile = join(targetDir, 'SKILL.md');
    const versionFile = join(targetDir, '.version');

    const skillMissing = !existsSync(skillFile);
    const recordedVersion = existsSync(versionFile) ? readFileSync(versionFile, 'utf-8').trim() : '';

    if (skillMissing || recordedVersion !== cliVersion()) {
      installSkill({ scope: 'global', claudeHome });
    }
  } catch {
    // swallow — never block the caller
  }
}
