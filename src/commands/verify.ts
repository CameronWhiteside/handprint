import { existsSync } from 'node:fs';
import { readObject } from '../store/objects.js';
import { hashObject, canonicalize, blake2b256 } from '../store/hash.js';
import { getRef } from '../store/refs.js';
import {
  verifyDetached,
  fromBase64url,
  toBase64url,
  deriveKeypair,
  ensureSodium,
} from '../crypto/sodium.js';
import { projectDir } from '../dirs/project.js';
import { loadAllSeeds } from '../dirs/global.js';
import { handprintObjectSchema } from '@handprint/types';

export interface VerifyResult {
  valid: boolean;
  chainLength: number;
  head: string | null;
  errors: Array<{ hash: string; error: string }>;
}

/**
 * Public keys this machine is allowed to attribute the chain to: the current
 * identity plus any rotated (archived) identities. Verification rejects entries
 * signed by any other key, so a chain forged or spliced with a foreign key does
 * not pass even though its individual signatures are internally valid.
 */
async function authorizedPubkeys(): Promise<Set<string>> {
  const set = new Set<string>();
  for (const seed of loadAllSeeds()) {
    const kp = await deriveKeypair(seed);
    set.add(toBase64url(kp.publicKey));
  }
  return set;
}

export async function verifyChain(projectRoot: string): Promise<VerifyResult> {
  await ensureSodium();
  const hpDir = projectDir(projectRoot);

  if (!existsSync(hpDir)) {
    throw new Error('not initialized');
  }

  const head = getRef(hpDir, 'HEAD');
  if (head === null) {
    return { valid: true, chainLength: 0, head: null, errors: [] };
  }

  const authorized = await authorizedPubkeys();
  const errors: Array<{ hash: string; error: string }> = [];
  let currentHash: string | null = head;
  let chainLength = 0;

  while (currentHash !== null) {
    const obj = readObject(hpDir, currentHash);
    if (obj === null) {
      errors.push({ hash: currentHash, error: 'object missing' });
      break;
    }

    const recomputedHash = await hashObject(obj);
    if (recomputedHash !== currentHash) {
      errors.push({ hash: currentHash, error: 'hash mismatch' });
      break;
    }

    const parsed = handprintObjectSchema.safeParse(obj);
    if (!parsed.success) {
      errors.push({ hash: currentHash, error: 'malformed object' });
      break;
    }
    const hp = parsed.data;

    // Trust anchor: the signing key must be one of this identity's keys.
    // Skip only when there is no local identity to anchor against.
    if (authorized.size > 0 && !authorized.has(hp.pubkey)) {
      errors.push({ hash: currentHash, error: 'unauthorized signing key' });
      break;
    }

    const { sig, ...unsigned } = hp;
    const canonical = canonicalize(unsigned);
    const digest = blake2b256(new TextEncoder().encode(canonical));
    const sigValid = await verifyDetached(
      fromBase64url(sig),
      digest,
      fromBase64url(hp.pubkey),
    );

    if (!sigValid) {
      errors.push({ hash: currentHash, error: 'invalid signature' });
      break;
    }

    chainLength++;
    currentHash = hp.parent;
  }

  return { valid: errors.length === 0, chainLength, head, errors };
}
