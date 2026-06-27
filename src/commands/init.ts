import { initGlobal, isGlobalInitialized } from '../dirs/global.js';
import { initProject, isProjectInitialized } from '../dirs/project.js';
import type { Visibility } from '@handprint/types';

export { isGlobalInitialized, isProjectInitialized };

export async function init(
  cwd: string,
  options: { global?: boolean; visibility?: Visibility } = {},
): Promise<string> {
  if (options.global) {
    const { execSync } = await import('node:child_process');
    let handle = 'unknown';
    let name = 'Unknown';
    let email = '';
    try {
      name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
      email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
      handle = name.toLowerCase().replace(/\s+/g, '');
    } catch { /* use defaults */ }

    const path = await initGlobal({ handle, name, email });

    if (!isProjectInitialized(cwd)) {
      initProject(cwd, options.visibility);
    }

    return path;
  }

  if (!isGlobalInitialized()) {
    throw new Error('global config not found: run "handprint init --global" first');
  }

  return initProject(cwd, options.visibility);
}
