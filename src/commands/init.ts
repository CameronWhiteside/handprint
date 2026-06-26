import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { type HandprintConfig, DEFAULT_PROTOCOL } from "../profile/types.js";
import { detectIdentity } from "./config.js";
import {
  generateSigningKeypair,
  generateEncryptionKey,
} from "../crypto/keys.js";

export const HANDPRINT_DIR = ".handprint";

/**
 * Initializes a new handprint store inside the given repository root.
 * Creates .handprint/ with objects/, refs/, meta/, keys/ subdirectories,
 * generates Ed25519 signing keypair and AES-256 encryption key,
 * writes config.json and taxonomy.json.
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
  mkdirSync(join(hpDir, "meta"), { recursive: true });
  mkdirSync(join(hpDir, "keys"), { recursive: true });

  // Generate Ed25519 signing keypair
  const { publicKey, privateKey } = generateSigningKeypair();
  writeFileSync(join(hpDir, "keys", "signing.pub"), publicKey, "utf-8");
  writeFileSync(join(hpDir, "keys", "signing.key"), privateKey, "utf-8");

  // Generate AES-256 encryption key
  const encKey = generateEncryptionKey();
  writeFileSync(
    join(hpDir, "keys", "encryption.key"),
    encKey.toString("hex"),
    "utf-8",
  );

  const config: HandprintConfig = {
    version: "0.1.0",
    createdAt: new Date().toISOString(),
    identity: detectIdentity(),
    remote: { type: "cloudflare-kv", accountId: "", namespaceId: null },
    protocol: DEFAULT_PROTOCOL,
  };

  writeFileSync(
    join(hpDir, "config.json"),
    JSON.stringify(config, null, 2),
    "utf-8",
  );

  // Write default taxonomy
  const taxonomy = {
    v: 1,
    types: {
      vision: {
        label: "What you wanted to achieve",
        subtypes: ["goal", "direction", "bet"],
      },
      choice: {
        label: "The decisions you made",
        subtypes: [
          "override",
          "rejection",
          "constraint",
          "wager",
          "direction",
        ],
      },
      method: {
        label: "The tools and knowledge you applied",
        subtypes: ["tools", "knowledge"],
      },
    },
    aliases: {
      direction: { type: "choice", subtype: "direction" },
      override: { type: "choice", subtype: "override" },
      rejection: { type: "choice", subtype: "rejection" },
      constraint: { type: "choice", subtype: "constraint" },
      wager: { type: "choice", subtype: "wager" },
      leverage: { type: "method" },
    },
  };

  writeFileSync(
    join(hpDir, "taxonomy.json"),
    JSON.stringify(taxonomy, null, 2),
    "utf-8",
  );

  return hpDir;
}
