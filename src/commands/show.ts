import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Handprint } from "../model/handprint.js";

export interface HandprintDetail extends Handprint {
  hash: string;
}

/**
 * Looks up a handprint by full hash or short prefix (min 7 chars).
 * Returns the handprint with its hash, or null if not found / ambiguous.
 */
export function showHandprint(
  repoRoot: string,
  ref: string,
): HandprintDetail | null {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (ref.length === 64) {
    return lookupFull(hpDir, ref);
  }

  if (ref.length >= 7) {
    return resolvePrefix(hpDir, ref);
  }

  return null;
}

function lookupFull(
  hpDir: string,
  hash: string,
): HandprintDetail | null {
  const obj = readObject(hpDir, hash);
  if (!obj) return null;
  return { ...obj, hash } as unknown as HandprintDetail;
}

function resolvePrefix(
  hpDir: string,
  prefix: string,
): HandprintDetail | null {
  const dirPrefix = prefix.slice(0, 2);
  const filePrefix = prefix.slice(2);
  const bucketDir = join(hpDir, "objects", dirPrefix);

  if (!existsSync(bucketDir)) return null;

  const files = readdirSync(bucketDir);
  const matches = files.filter((f) => f.startsWith(filePrefix));

  if (matches.length !== 1) return null;

  const fullHash = dirPrefix + matches[0];
  return lookupFull(hpDir, fullHash);
}
