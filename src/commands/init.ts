import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type HandprintConfig, DEFAULT_PROTOCOL } from "../profile/types.js";
import { detectIdentity } from "./config.js";

export const HANDPRINT_DIR = ".handprint";

/**
 * Initializes a new handprint store inside the given repository root.
 * Creates .handprint/ with objects/, refs/, staging/ subdirectories
 * and a config.json manifest with identity, remote, and protocol defaults.
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

  const config: HandprintConfig = {
    version: "0.1.0",
    createdAt: new Date().toISOString(),
    identity: detectIdentity(),
    remote: { type: "cloudflare-kv", accountId: "", namespaceId: null },
    protocol: DEFAULT_PROTOCOL,
  };

  writeFileSync(join(hpDir, "config.json"), JSON.stringify(config, null, 2), "utf-8");

  return hpDir;
}
