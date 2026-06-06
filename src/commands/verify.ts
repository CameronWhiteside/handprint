import { existsSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { hashObject } from "../store/hash.js";
import { getRef } from "../store/refs.js";
import { HANDPRINT_DIR } from "./init.js";

export interface VerifyResult {
  valid: boolean;
  chainLength: number;
  head: string | null;
  errors: Array<{ hash: string; error: string }>;
}

/**
 * Verifies the integrity of the hash chain by walking from HEAD
 * back to the genesis handprint.
 *
 * For each entry:
 *   - Confirms the object exists in the store
 *   - Re-hashes the content and verifies it matches the stored hash
 *   - Verifies the parent pointer is consistent with the chain
 *
 * Throws if the handprint store has not been initialized.
 */
export function verifyChain(repoRoot: string): VerifyResult {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (!existsSync(hpDir)) {
    throw new Error("not initialized");
  }

  const head = getRef(hpDir, "HEAD");

  if (head === null) {
    return { valid: true, chainLength: 0, head: null, errors: [] };
  }

  const errors: Array<{ hash: string; error: string }> = [];
  let currentHash: string | null = head;
  let chainLength = 0;

  while (currentHash !== null) {
    const obj = readObject(hpDir, currentHash);

    if (obj === null) {
      // If this is the head, it's "object missing"; if it's a parent, the
      // caller already added a "parent missing" error — but we still need
      // to record the missing object itself and stop walking.
      if (currentHash === head) {
        errors.push({ hash: currentHash, error: "object missing" });
      }
      break;
    }

    // Re-hash and verify
    const recomputedHash = hashObject(obj);
    if (recomputedHash !== currentHash) {
      errors.push({ hash: currentHash, error: "hash mismatch" });
      // Content is tampered, can't trust the parent pointer — stop walking
      break;
    }

    chainLength++;

    const parentHash = (obj.parent as string | null) ?? null;

    if (parentHash !== null) {
      // Verify the parent object exists before we try to walk to it
      const parentObj = readObject(hpDir, parentHash);
      if (parentObj === null) {
        errors.push({ hash: currentHash, error: "parent missing" });
        break;
      }
    }

    currentHash = parentHash;
  }

  return {
    valid: errors.length === 0,
    chainLength,
    head,
    errors,
  };
}
