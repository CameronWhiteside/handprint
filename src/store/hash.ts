import sodium from 'libsodium-wrappers';
import { ensureSodium } from '../crypto/sodium.js';

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }

  const sorted = Object.keys(value as Record<string, unknown>).sort();
  const entries = sorted.map(
    (key) =>
      JSON.stringify(key) +
      ':' +
      canonicalize((value as Record<string, unknown>)[key]),
  );
  return '{' + entries.join(',') + '}';
}

export function sha256(data: Uint8Array): Uint8Array {
  return sodium.crypto_generichash(32, data);
}

export async function hashObject(obj: Record<string, unknown>): Promise<string> {
  await ensureSodium();
  const canonical = canonicalize(obj);
  const hash = sha256(new TextEncoder().encode(canonical));
  return sodium.to_hex(hash);
}
