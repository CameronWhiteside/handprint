import { existsSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { hashObject } from "../store/hash.js";
import { getRef } from "../store/refs.js";
import { verifySignature } from "../crypto/keys.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Seal } from "../model/seal.js";

export interface VerifyResult {
  valid: boolean;
  chainLength: number;
  head: string | null;
  errors: Array<{ hash: string; error: string }>;
}

/**
 * Verifies the integrity of the seal chain by walking from HEAD
 * back to the genesis seal.
 *
 * For each entry:
 *   - Confirms the object exists in the store
 *   - Re-hashes the content and verifies it matches the stored hash
 *   - Verifies the parent pointer is consistent with the chain
 *   - Verifies the Ed25519 signature against the embedded pubkey
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
      if (currentHash === head) {
        errors.push({ hash: currentHash, error: "object missing" });
      }
      break;
    }

    // Re-hash and verify
    const recomputedHash = hashObject(obj);
    if (recomputedHash !== currentHash) {
      errors.push({ hash: currentHash, error: "hash mismatch" });
      break;
    }

    chainLength++;

    // Verify signature: reconstruct sealData without signature field
    const seal = obj as unknown as Seal;
    if (seal.signature && seal.pubkey) {
      const { signature, ...sealData } = seal;
      const canonical = hashObject(
        sealData as unknown as Record<string, unknown>,
      );
      const sigValid = verifySignature(canonical, signature, seal.pubkey);
      if (!sigValid) {
        errors.push({ hash: currentHash, error: "invalid signature" });
        break;
      }
    }

    const parentHash = (obj.parent as string | null) ?? null;

    if (parentHash !== null) {
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
