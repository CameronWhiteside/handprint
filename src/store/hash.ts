import { blake2b } from '@noble/hashes/blake2.js';
import { bytesToHex } from '@noble/hashes/utils.js';

const isRecord = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === 'object';

/**
 * Deterministic canonical JSON serialization used as the signing/hashing input.
 * Object keys are sorted; primitives are JSON-encoded. Non-finite numbers and
 * undefined are rejected so the canonical form stays injective (two distinct
 * inputs never collide to the same string). This is handprint's own canonical
 * form; an external verifier must reproduce exactly this algorithm.
 */
export function canonicalize(value: unknown): string {
  if (value === undefined) {
    throw new Error('cannot canonicalize undefined');
  }
  if (typeof value === 'number' && !Number.isFinite(value)) {
    throw new Error('cannot canonicalize non-finite number');
  }
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }

  const record = isRecord(value) ? value : {};
  const sorted = Object.keys(record).sort();
  const entries = sorted.map(
    (key) => JSON.stringify(key) + ':' + canonicalize(record[key]),
  );
  return '{' + entries.join(',') + '}';
}

/**
 * handprint's content hash: BLAKE2b-256 (dkLen 32, unkeyed).
 * Named precisely so external verifiers reproduce the right algorithm.
 */
export function blake2b256(data: Uint8Array): Uint8Array {
  return blake2b(data, { dkLen: 32 });
}

export async function hashObject(obj: object): Promise<string> {
  const canonical = canonicalize(obj);
  const hash = blake2b256(new TextEncoder().encode(canonical));
  return bytesToHex(hash);
}
