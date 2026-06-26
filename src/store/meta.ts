import {
  existsSync,
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import type { DecisionMeta } from "../model/meta.js";
import { hashObject } from "./hash.js";

export function writeMeta(storeDir: string, meta: DecisionMeta): string {
  const metaDir = join(storeDir, "meta");
  if (!existsSync(metaDir)) mkdirSync(metaDir, { recursive: true });

  const hash = hashObject(meta as unknown as Record<string, unknown>);
  const prefix = hash.slice(0, 2);
  const dir = join(metaDir, prefix);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

  writeFileSync(
    join(dir, hash.slice(2)),
    JSON.stringify(meta, null, 2),
    "utf-8",
  );
  return hash;
}

export function readMeta(
  storeDir: string,
  hash: string,
): DecisionMeta | null {
  const prefix = hash.slice(0, 2);
  const path = join(storeDir, "meta", prefix, hash.slice(2));
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function listAllMeta(storeDir: string): DecisionMeta[] {
  const metaDir = join(storeDir, "meta");
  if (!existsSync(metaDir)) return [];

  const results: DecisionMeta[] = [];
  for (const prefix of readdirSync(metaDir)) {
    const prefixDir = join(metaDir, prefix);
    try {
      if (!statSync(prefixDir).isDirectory()) continue;
      for (const file of readdirSync(prefixDir)) {
        const content = readFileSync(join(prefixDir, file), "utf-8");
        results.push(JSON.parse(content));
      }
    } catch {
      /* skip bad entries */
    }
  }
  return results;
}

// List all meta entries for a given seal hash
export function metaForSeal(
  storeDir: string,
  sealHash: string,
): DecisionMeta[] {
  return listAllMeta(storeDir).filter((m) => m.seal === sealHash);
}
