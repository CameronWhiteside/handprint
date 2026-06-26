import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { writeObject } from "../store/objects.js";
import { getRef, setRef } from "../store/refs.js";
import { hashObject } from "../store/hash.js";
import { encrypt, signData } from "../crypto/keys.js";
import { sanitize } from "../sanitizer/sanitize.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Seal, SealInput } from "../model/seal.js";

export type { SealInput };

/**
 * Seals a conversation chunk: sanitizes, encrypts, signs, and persists
 * to the content-addressable store as part of the merkle chain.
 *
 * Throws if the handprint store has not been initialized.
 * Returns the SHA-256 hash of the sealed object.
 */
export function sealChunk(repoRoot: string, input: SealInput): string {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (!existsSync(hpDir)) {
    throw new Error("not initialized");
  }

  const encKey = Buffer.from(
    readFileSync(join(hpDir, "keys", "encryption.key"), "utf-8").trim(),
    "hex",
  );
  const privKey = readFileSync(
    join(hpDir, "keys", "signing.key"),
    "utf-8",
  );
  const pubKey = readFileSync(
    join(hpDir, "keys", "signing.pub"),
    "utf-8",
  );

  const sanitized = sanitize(input.plaintext);
  const encrypted = encrypt(sanitized, encKey);

  const currentHead = getRef(hpDir, "HEAD");

  const sealData: Omit<Seal, "signature"> = {
    v: 1,
    ts: input.ts,
    session: input.session,
    project: input.project,
    author: input.author,
    parent: currentHead,
    payload: encrypted,
    pubkey: pubKey,
  };

  // Sign the canonical hash of the seal data (without signature)
  const canonical = hashObject(
    sealData as unknown as Record<string, unknown>,
  );
  const signature = signData(canonical, privKey);

  const seal: Seal = { ...sealData, signature };

  const hash = writeObject(
    hpDir,
    seal as unknown as Record<string, unknown>,
  );
  setRef(hpDir, "HEAD", hash);
  appendFileSync(join(hpDir, "log"), hash + "\n", "utf-8");

  return hash;
}
