import { existsSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { getRef } from "../store/refs.js";
import { listAllMeta } from "../store/meta.js";
import { HANDPRINT_DIR } from "./init.js";
import { listSeals } from "./log.js";
import type { DecisionMeta } from "../model/meta.js";
import type { Seal } from "../model/seal.js";

export interface ExportedSeal {
  hash: string;
  seal: Seal;
}

export interface ExportResult {
  version: string;
  exportedAt: string;
  seals: ExportedSeal[];
  meta: DecisionMeta[];
}

/**
 * Exports all seals and meta entries as a structured JSON-serializable object.
 */
export function exportHandprints(repoRoot: string): ExportResult {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (!existsSync(hpDir)) {
    throw new Error("not initialized");
  }

  const sealEntries = listSeals(repoRoot);
  const seals: ExportedSeal[] = sealEntries.map((entry) => ({
    hash: entry.hash,
    seal: entry.seal,
  }));

  const meta = listAllMeta(hpDir);

  return {
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    seals,
    meta,
  };
}
