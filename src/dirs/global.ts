import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GlobalConfig } from '@handprint/types';
import {
  generateSeed,
  toBase64url,
  fromBase64url,
} from '../crypto/noble.js';

export function globalDir(): string {
  return process.env.HANDPRINT_HOME ?? join(homedir(), '.handprint');
}

export function isGlobalInitialized(): boolean {
  const dir = globalDir();
  return existsSync(join(dir, 'keys', 'seed')) && existsSync(join(dir, 'config.json'));
}

export async function initGlobal(
  identity: { handle: string; name: string; email: string },
  hubUrl: string = 'https://handprint.sh',
): Promise<string> {
  const dir = globalDir();

  if (isGlobalInitialized()) {
    throw new Error('already initialized');
  }

  const keysDir = join(dir, 'keys');
  mkdirSync(keysDir, { recursive: true });
  chmodSync(keysDir, 0o700);

  mkdirSync(join(dir, 'sources'), { recursive: true });

  const seed = await generateSeed();
  const seedPath = join(keysDir, 'seed');
  writeFileSync(seedPath, toBase64url(seed), { mode: 0o600 });

  const config: GlobalConfig = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    identity,
    hub: { url: hubUrl },
  };

  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2));

  return dir;
}

export function loadGlobalConfig(): GlobalConfig {
  const configPath = join(globalDir(), 'config.json');
  if (!existsSync(configPath)) {
    throw new Error('not initialized: run "handprint init --global" first');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const configPath = join(globalDir(), 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function seedFilePath(): string {
  return join(globalDir(), 'keys', 'seed');
}

function seedHistoryDir(): string {
  return join(globalDir(), 'keys', 'history');
}

export function loadSeed(): Uint8Array {
  const path = seedFilePath();
  if (!existsSync(path)) {
    throw new Error('no seed found: run "handprint init --global" first');
  }
  return fromBase64url(readFileSync(path, 'utf-8').trim());
}

/** Previously-active seeds, archived on rotation. Empty if never rotated. */
function loadHistoricalSeeds(): Uint8Array[] {
  const dir = seedHistoryDir();
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.seed'))
    .map((f) => fromBase64url(readFileSync(join(dir, f), 'utf-8').trim()));
}

/** Current seed first, then all archived historical seeds. */
export function loadAllSeeds(): Uint8Array[] {
  const seeds: Uint8Array[] = [];
  if (existsSync(seedFilePath())) seeds.push(loadSeed());
  seeds.push(...loadHistoricalSeeds());
  return seeds;
}

/** Write the active seed with strict permissions (0600). */
export function writeSeedFile(seed: Uint8Array): void {
  const path = seedFilePath();
  writeFileSync(path, toBase64url(seed), { mode: 0o600 });
  chmodSync(path, 0o600);
}

/** Archive a seed under keys/history so its payloads stay decryptable and its
 *  signatures stay verifiable after rotation. Named by the caller (fingerprint). */
export function archiveSeedFile(seed: Uint8Array, name: string): void {
  const dir = seedHistoryDir();
  mkdirSync(dir, { recursive: true });
  chmodSync(dir, 0o700);
  const path = join(dir, `${name}.seed`);
  writeFileSync(path, toBase64url(seed), { mode: 0o600 });
  chmodSync(path, 0o600);
}
