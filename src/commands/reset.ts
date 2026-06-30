// src/commands/reset.ts
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { findProjectRoot, projectDir } from '../dirs/project.js';

export interface ResetPlan {
  projectRoot: string;
  /** Number of handprints in the local chain that will be removed. */
  handprints: number;
}

export interface ResetResult {
  plan: ResetPlan;
  confirmed: boolean;
  needsConfirm: boolean;
  removed: number;
}

export interface ResetOptions {
  force?: boolean;
  confirm?: (plan: ResetPlan) => Promise<boolean>;
}

// What a reset clears: the content-addressed objects, the chain log, and the
// incremental grab watermark. The project config and the global identity/keys
// are deliberately kept.
const RESET_TARGETS = ['objects', 'log', 'grabbed.json'] as const;

function countHandprints(hpDir: string): number {
  const logPath = join(hpDir, 'log');
  if (!existsSync(logPath)) return 0;
  return readFileSync(logPath, 'utf-8').split('\n').filter(Boolean).length;
}

export async function reset(cwd: string, options: ResetOptions = {}): Promise<ResetResult> {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot) {
    throw new Error('not a handprint project: run "handprint init" first');
  }
  const hpDir = projectDir(projectRoot);
  const plan: ResetPlan = { projectRoot, handprints: countHandprints(hpDir) };
  const base: ResetResult = { plan, confirmed: false, needsConfirm: false, removed: 0 };

  let proceed = false;
  if (options.force) {
    proceed = true;
  } else if (options.confirm) {
    proceed = await options.confirm(plan);
  } else {
    return { ...base, needsConfirm: true };
  }
  if (!proceed) return base;

  for (const name of RESET_TARGETS) {
    rmSync(join(hpDir, name), { recursive: true, force: true });
  }
  return { ...base, confirmed: true, removed: plan.handprints };
}
