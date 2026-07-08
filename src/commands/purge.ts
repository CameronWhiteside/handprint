import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { globalDir, loadGlobalConfig } from '../dirs/global.js';
import { createHubClient } from '../hub/client.js';

export interface PurgeResult {
  purged: number;
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

/**
 * Delete ALL of the caller's handprints from the hub. Self-only; the account,
 * keys, and local chain are untouched (use `handprint reset` for the local
 * chain). Pairs with reset for a clean re-grab.
 */
export async function purge(): Promise<PurgeResult> {
  const globalConfig = loadGlobalConfig();
  const client = createHubClient(globalConfig.hub.url, loadToken());
  return client.purge();
}
