import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

/**
 * Writes a hash to a named ref file at storeDir/refs/<name>.
 */
export function setRef(storeDir: string, name: string, hash: string): void {
  const refsDir = join(storeDir, "refs");
  mkdirSync(refsDir, { recursive: true });
  writeFileSync(join(refsDir, name), hash, "utf-8");
}

/**
 * Reads the hash stored in a named ref.
 * Returns null if the ref does not exist.
 */
export function getRef(storeDir: string, name: string): string | null {
  const refPath = join(storeDir, "refs", name);
  if (!existsSync(refPath)) return null;
  return readFileSync(refPath, "utf-8").trim();
}

/**
 * Lists all refs as {name, hash} pairs.
 * Returns an empty array if the refs directory does not exist.
 */
export function listRefs(
  storeDir: string,
): Array<{ name: string; hash: string }> {
  const refsDir = join(storeDir, "refs");
  if (!existsSync(refsDir)) return [];

  const entries = readdirSync(refsDir);
  return entries.map((name) => ({
    name,
    hash: readFileSync(join(refsDir, name), "utf-8").trim(),
  }));
}
