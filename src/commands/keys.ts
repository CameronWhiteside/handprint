import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSeed, loadGlobalConfig, globalDir } from '../dirs/global.js';
import {
  deriveKeypair,
  fingerprint,
  toBase64url,
  generateSeed,
  ensureSodium,
} from '../crypto/sodium.js';
import { createHubClient } from '../hub/client.js';

function loadToken(): string {
  const credPath = join(globalDir(), 'credentials.json');
  const creds = JSON.parse(readFileSync(credPath, 'utf-8'));
  if (!creds.accessToken) throw new Error('not logged in');
  return creds.accessToken;
}

export async function keysAdd(label: string): Promise<{ fingerprint: string }> {
  await ensureSodium();
  const seed = loadSeed();
  const kp = await deriveKeypair(seed);
  const fp = fingerprint(kp.publicKey);
  const pubkey = toBase64url(kp.publicKey);

  const config = loadGlobalConfig();
  const token = loadToken();
  const client = createHubClient(config.hub.url, token);

  await client.registerKey({ pubkey, label });

  return { fingerprint: fp };
}

export async function keysList(): Promise<{
  fingerprint: string;
  pubkey: string;
}> {
  await ensureSodium();
  const seed = loadSeed();
  const kp = await deriveKeypair(seed);
  return {
    fingerprint: fingerprint(kp.publicKey),
    pubkey: toBase64url(kp.publicKey),
  };
}

export async function keysRotate(): Promise<{ fingerprint: string }> {
  await ensureSodium();
  const newSeed = await generateSeed();
  const kp = await deriveKeypair(newSeed);
  const fp = fingerprint(kp.publicKey);

  const seedPath = join(globalDir(), 'keys', 'seed');
  writeFileSync(seedPath, toBase64url(newSeed), { mode: 0o600 });

  return { fingerprint: fp };
}

export async function keysExport(): Promise<string> {
  const seed = loadSeed();
  return toBase64url(seed);
}
