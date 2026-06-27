import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import type { ProjectConfig, Visibility } from '@handprint/types';

const HANDPRINT_DIR = '.handprint';

const AGENTS_MD = `# Handprint

Decision provenance. Run \`handprint grab\` after significant decisions.

- Types/schemas: \`@handprint-sh/types\` (npm)
- CLI: \`handprint --help\`
- Docs: handprint.sh/docs
`;

const GITIGNORE = `# Handprint — track config and AGENTS.md, ignore local state
*
!.gitignore
!config.json
!AGENTS.md
objects/
refs/
log
`;

export function projectDir(cwd: string = process.cwd()): string {
  return join(cwd, HANDPRINT_DIR);
}

export function isProjectInitialized(cwd: string = process.cwd()): boolean {
  return existsSync(join(projectDir(cwd), 'config.json'));
}

export function initProject(
  cwd: string,
  visibility: Visibility = 'private',
): string {
  const dir = projectDir(cwd);

  if (isProjectInitialized(cwd)) {
    throw new Error('already initialized');
  }

  mkdirSync(join(dir, 'objects'), { recursive: true });
  mkdirSync(join(dir, 'refs'), { recursive: true });

  const config: ProjectConfig = {
    version: '1.0.0',
    visibility,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, 'AGENTS.md'), AGENTS_MD);
  writeFileSync(join(dir, '.gitignore'), GITIGNORE);

  return dir;
}

export function loadProjectConfig(cwd: string = process.cwd()): ProjectConfig {
  const configPath = join(projectDir(cwd), 'config.json');
  if (!existsSync(configPath)) {
    throw new Error('not initialized: run "handprint init" first');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveProjectConfig(cwd: string, config: ProjectConfig): void {
  writeFileSync(
    join(projectDir(cwd), 'config.json'),
    JSON.stringify(config, null, 2),
  );
}

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, HANDPRINT_DIR, 'config.json'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
