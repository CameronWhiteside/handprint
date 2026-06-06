import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { listHandprints } from "./log.js";
import { HANDPRINT_DIR } from "./init.js";
import type { HandprintEntry } from "./log.js";
import type { Resolution } from "../model/resolution.js";

export interface ExportedHandprint extends HandprintEntry {
  resolutions: Resolution[];
}

export interface ExportResult {
  version: string;
  exportedAt: string;
  handprints: ExportedHandprint[];
}

/**
 * Exports all handprints with their linked resolutions as a structured
 * JSON-serializable object.
 */
export function exportHandprints(repoRoot: string): ExportResult {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const entries = listHandprints(repoRoot);

  // Read all resolution hashes
  const resolutions = loadResolutions(hpDir);

  // Link resolutions to their handprints
  const handprints: ExportedHandprint[] = entries.map((entry) => {
    const linked = resolutions.filter(
      (r) => r.handprintHash === entry.hash,
    );
    return { ...entry, resolutions: linked };
  });

  return {
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    handprints,
  };
}

function loadResolutions(hpDir: string): Resolution[] {
  const resPath = join(hpDir, "resolutions");

  if (!existsSync(resPath)) {
    return [];
  }

  const content = readFileSync(resPath, "utf-8");
  const hashes = content.split("\n").filter(Boolean);

  const resolutions: Resolution[] = [];

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (obj) {
      resolutions.push(obj as unknown as Resolution);
    }
  }

  return resolutions;
}
