import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Handprint, HandprintType } from "../model/handprint.js";

export interface HandprintEntry extends Handprint {
  hash: string;
}

export interface ListOptions {
  type?: HandprintType;
}

/**
 * Lists all sealed handprints from the log index.
 * Optionally filters by handprint type.
 * Returns an empty array if no log file exists.
 */
export function listHandprints(
  repoRoot: string,
  options?: ListOptions,
): HandprintEntry[] {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const logPath = join(hpDir, "log");

  if (!existsSync(logPath)) {
    return [];
  }

  const logContent = readFileSync(logPath, "utf-8");
  const hashes = logContent.split("\n").filter(Boolean);

  const entries: HandprintEntry[] = [];

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!obj) continue;

    const entry = { ...obj, hash } as unknown as HandprintEntry;

    if (options?.type && entry.type !== options.type) {
      continue;
    }

    entries.push(entry);
  }

  return entries;
}
