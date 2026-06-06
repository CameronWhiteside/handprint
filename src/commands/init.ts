import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export const HANDPRINT_DIR = ".handprint";

/**
 * Initializes a new handprint store inside the given repository root.
 * Creates .handprint/ with objects/, refs/, staging/ subdirectories
 * and a config.json manifest.
 *
 * Throws if .handprint/ already exists.
 * Returns the absolute path to the .handprint/ directory.
 */
export function initStore(repoRoot: string): string {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (existsSync(hpDir)) {
    throw new Error("already initialized");
  }

  mkdirSync(join(hpDir, "objects"), { recursive: true });
  mkdirSync(join(hpDir, "refs"), { recursive: true });
  mkdirSync(join(hpDir, "staging"), { recursive: true });

  const config = {
    version: "0.1.0",
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(hpDir, "config.json"), JSON.stringify(config, null, 2), "utf-8");

  return hpDir;
}
