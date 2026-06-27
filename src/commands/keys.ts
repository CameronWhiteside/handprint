import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  loadSeed,
  loadGlobalConfig,
  globalDir,
  writeSeedFile,
  archiveSeedFile,
} from '../dirs/global.js';
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

export async function keysRotate(): Promise<{
  fingerprint: string;
  previousFingerprint: string;
}> {
  await ensureSodium();

  // Archive the current seed before replacing it. The encryption key is derived
  // from the seed, so without this every payload written under the old key would
  // become permanently undecryptable, and signatures made by the old key would
  // stop verifying. Archived seeds keep old payloads readable and old entries
  // verifiable as authorized.
  const currentSeed = loadSeed();
  const currentKp = await deriveKeypair(currentSeed);
  const previousFingerprint = fingerprint(currentKp.publicKey);
  archiveSeedFile(currentSeed, previousFingerprint);

  const newSeed = await generateSeed();
  const newKp = await deriveKeypair(newSeed);
  writeSeedFile(newSeed);

  return { fingerprint: fingerprint(newKp.publicKey), previousFingerprint };
}

export async function keysExport(): Promise<string> {
  const seed = loadSeed();
  return toBase64url(seed);
}
