import {
  existsSync,
  mkdirSync,
  readFileSync,
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
} from '../crypto/sodium.js';

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

export function loadSeed(): Uint8Array {
  const seedPath = join(globalDir(), 'keys', 'seed');
  if (!existsSync(seedPath)) {
    throw new Error('no seed found: run "handprint init --global" first');
  }
  const encoded = readFileSync(seedPath, 'utf-8').trim();
  return fromBase64url(encoded);
}
