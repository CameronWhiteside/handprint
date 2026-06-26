import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { listAllMeta } from "../store/meta.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Seal } from "../model/seal.js";
import type { DecisionMeta } from "../model/meta.js";

export interface SealEntry {
  hash: string;
  seal: Seal;
}

export interface ListOptions {
  type?: string;
}

/**
 * Lists all sealed entries from the log index.
 * Returns an empty array if no log file exists.
 */
export function listSeals(repoRoot: string): SealEntry[] {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const logPath = join(hpDir, "log");

  if (!existsSync(logPath)) {
    return [];
  }

  const logContent = readFileSync(logPath, "utf-8");
  const hashes = logContent.split("\n").filter(Boolean);

  const entries: SealEntry[] = [];

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!obj) continue;
    entries.push({ hash, seal: obj as unknown as Seal });
  }

  return entries;
}

/**
 * Lists meta entries (decisions), optionally filtered by type.
 * Each line shows: seal hash prefix, type, subtype, date, intent.
 */
export function listDecisions(
  repoRoot: string,
  options?: ListOptions,
): DecisionMeta[] {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (!existsSync(hpDir)) {
    return [];
  }

  let metas = listAllMeta(hpDir);

  if (options?.type) {
    metas = metas.filter((m) => m.type === options.type);
  }

  return metas;
}
