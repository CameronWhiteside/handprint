import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { globalDir, loadGlobalConfig } from '../dirs/global.js';
import { projectDir } from '../dirs/project.js';
import { readObject } from '../store/objects.js';
import { createHubClient } from '../hub/client.js';
import type { PushHandprintInput, HandprintObject } from '@handprint/types';

export interface PushResult {
  pushed: number;
  skipped: number;
}

function loadToken(): string {
  const credPath = join(globalDir(), 'credentials.json');
  if (!existsSync(credPath)) {
    throw new Error('not logged in: run "handprint login" first');
  }
  const creds = JSON.parse(readFileSync(credPath, 'utf-8'));
  if (!creds.accessToken) {
    throw new Error('no access token: run "handprint login" first');
  }
  return creds.accessToken;
}

export async function push(projectRoot: string): Promise<PushResult> {
  const globalConfig = loadGlobalConfig();
  const token = loadToken();
  const client = createHubClient(globalConfig.hub.url, token);

  const hpDir = projectDir(projectRoot);
  const logPath = join(hpDir, 'log');

  if (!existsSync(logPath)) {
    return { pushed: 0, skipped: 0 };
  }

  const hashes = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);

  let pushed = 0;
  let skipped = 0;

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!obj) {
      skipped++;
      continue;
    }

    const hp = obj as unknown as HandprintObject;
    const input: PushHandprintInput = {
      v: hp.v,
      ts: hp.ts,
      marks: hp.marks,
      artifacts: hp.artifacts,
      source: hp.source,
      parent: hp.parent,
      sig: hp.sig,
      pubkey: hp.pubkey,
    };

    try {
      await client.pushHandprint(input);
      pushed++;
    } catch (err) {
      console.error(`  failed to push ${hash.slice(0, 10)}: ${(err as Error).message}`);
      skipped++;
    }
  }

  return { pushed, skipped };
}
