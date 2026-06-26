import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { metaForSeal } from "../store/meta.js";
import { decrypt } from "../crypto/keys.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Seal } from "../model/seal.js";
import type { DecisionMeta } from "../model/meta.js";

export interface SealDetail {
  hash: string;
  seal: Seal;
  meta: DecisionMeta[];
  decryptedPayload?: string;
}

/**
 * Looks up a seal by full hash or short prefix (min 7 chars).
 * Returns the seal with its hash and associated meta entries.
 * If decryptPayload is true, loads the encryption key and decrypts.
 */
export function showSeal(
  repoRoot: string,
  ref: string,
  options?: { decryptPayload?: boolean },
): SealDetail | null {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  let fullHash: string | null = null;

  if (ref.length === 64) {
    fullHash = ref;
  } else if (ref.length >= 7) {
    fullHash = resolvePrefix(hpDir, ref);
  }

  if (!fullHash) return null;

  const obj = readObject(hpDir, fullHash);
  if (!obj) return null;

  const seal = obj as unknown as Seal;
  const meta = metaForSeal(hpDir, fullHash);

  const result: SealDetail = { hash: fullHash, seal, meta };

  if (options?.decryptPayload && seal.payload) {
    try {
      const encKey = Buffer.from(
        readFileSync(
          join(hpDir, "keys", "encryption.key"),
          "utf-8",
        ).trim(),
        "hex",
      );
      result.decryptedPayload = decrypt(seal.payload, encKey);
    } catch {
      // decryption failed — leave undefined
    }
  }

  return result;
}

function resolvePrefix(hpDir: string, prefix: string): string | null {
  const dirPrefix = prefix.slice(0, 2);
  const filePrefix = prefix.slice(2);
  const bucketDir = join(hpDir, "objects", dirPrefix);

  if (!existsSync(bucketDir)) return null;

  const files = readdirSync(bucketDir);
  const matches = files.filter((f) => f.startsWith(filePrefix));

  if (matches.length !== 1) return null;

  return dirPrefix + matches[0];
}
