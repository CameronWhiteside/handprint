import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { globalDir, loadGlobalConfig } from '../dirs/global.js';
import { projectDir } from '../dirs/project.js';
import { readObject } from '../store/objects.js';
import { createHubClient } from '../hub/client.js';
import { PUSH_HANDPRINTS_MAX } from '@handprint/types';
import type { PushHandprintInput, HandprintObject } from '@handprint/types';

export interface PushResult {
  pushed: number;
  duplicates: number;
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
    return { pushed: 0, duplicates: 0, skipped: 0 };
  }

  const hashes = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);

  let skipped = 0;

  // Load every handprint object, skipping any that can't be read.
  const inputs: PushHandprintInput[] = [];
  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!isHandprintObject(obj)) {
      skipped++;
      continue;
    }
    inputs.push({
      v: obj.v,
      ts: obj.ts,
      marks: obj.marks,
      artifacts: obj.artifacts,
      source: obj.source,
      parent: obj.parent,
      sig: obj.sig,
      pubkey: obj.pubkey,
    });
  }

  // Push in batches. The API upserts idempotently on (userId, sig), so a batch
  // is safe to retry; the client retries 429/5xx with backoff internally.
  let pushed = 0;
  let duplicates = 0;
  for (let i = 0; i < inputs.length; i += PUSH_HANDPRINTS_MAX) {
    const batch = inputs.slice(i, i + PUSH_HANDPRINTS_MAX);
    try {
      const result = await client.pushHandprints(batch);
      pushed += result.accepted;
      duplicates += result.duplicates;
      skipped += result.errors.length;
    } catch (err) {
      console.error(`  failed to push batch of ${batch.length}: ${(err as Error).message}`);
      skipped += batch.length;
    }
  }

  return { pushed, duplicates, skipped };
}

function isHandprintObject(obj: unknown): obj is HandprintObject {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'sig' in obj &&
    'marks' in obj &&
    'pubkey' in obj
  );
}
