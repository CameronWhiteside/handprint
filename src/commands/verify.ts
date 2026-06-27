import { existsSync } from 'node:fs';
import { readObject } from '../store/objects.js';
import { hashObject, canonicalize, sha256 } from '../store/hash.js';
import { getRef } from '../store/refs.js';
import { verifyDetached, fromBase64url, ensureSodium } from '../crypto/sodium.js';
import { projectDir } from '../dirs/project.js';
import type { HandprintObject } from '@handprint/types';

export interface VerifyResult {
  valid: boolean;
  chainLength: number;
  head: string | null;
  errors: Array<{ hash: string; error: string }>;
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

    const hp = obj as unknown as HandprintObject;

    const { sig, ...unsigned } = hp;
    const canonical = canonicalize(unsigned as unknown as Record<string, unknown>);
    const digest = sha256(new TextEncoder().encode(canonical));
    const sigBytes = fromBase64url(sig);
    const pubkeyBytes = fromBase64url(hp.pubkey);
    const sigValid = await verifyDetached(sigBytes, digest, pubkeyBytes);

    if (!sigValid) {
      errors.push({ hash: currentHash, error: 'invalid signature' });
      break;
    }

    chainLength++;
    currentHash = hp.parent;
  }

  return { valid: errors.length === 0, chainLength, head, errors };
}
