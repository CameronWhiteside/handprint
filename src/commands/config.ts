import {
  loadGlobalConfig,
  saveGlobalConfig,
} from '../dirs/global.js';
import {
  loadProjectConfig,
  saveProjectConfig,
} from '../dirs/project.js';

export function getConfig(cwd: string, scope: 'global' | 'project' = 'project'): unknown {
  if (scope === 'global') {
    return loadGlobalConfig();
  }
  return loadProjectConfig(cwd);
}

export function getConfigValue(config: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setConfigValue(
  config: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(config));
  const parts = path.split('.');
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  if (typeof value === 'string') {
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (!isNaN(Number(value)) && value !== '') value = Number(value);
  }
  current[parts[parts.length - 1]] = value;
  return result;
}

export { saveGlobalConfig, saveProjectConfig };
