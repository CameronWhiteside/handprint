import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isGlobalInitialized, loadSeed, loadGlobalConfig } from '../dirs/global.js';
import { isProjectInitialized, loadProjectConfig, projectDir } from '../dirs/project.js';
import { deriveKeypair, fingerprint, toBase64url, ensureSodium } from '../crypto/sodium.js';
import { getRef } from '../store/refs.js';

export interface StatusResult {
  globalInitialized: boolean;
  projectInitialized: boolean;
  handle: string | null;
  fingerprint: string | null;
  visibility: string | null;
  chainHead: string | null;
  chainLength: number;
}

export async function status(projectRoot: string): Promise<StatusResult> {
  await ensureSodium();

  const result: StatusResult = {
    globalInitialized: isGlobalInitialized(),
    projectInitialized: isProjectInitialized(projectRoot),
    handle: null,
    fingerprint: null,
    visibility: null,
    chainHead: null,
    chainLength: 0,
  };

  if (result.globalInitialized) {
    const config = loadGlobalConfig();
    result.handle = config.identity.handle;

    try {
      const seed = loadSeed();
      const kp = await deriveKeypair(seed);
      result.fingerprint = fingerprint(kp.publicKey);
    } catch { /* seed missing */ }
  }

  if (result.projectInitialized) {
    const config = loadProjectConfig(projectRoot);
    result.visibility = config.visibility;

    const hpDir = projectDir(projectRoot);
    result.chainHead = getRef(hpDir, 'HEAD');

    const logPath = join(hpDir, 'log');
    if (existsSync(logPath)) {
      const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
      result.chainLength = lines.length;
    }
  }

  return result;
}
