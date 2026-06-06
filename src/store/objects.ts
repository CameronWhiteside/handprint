import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { hashObject } from "./hash.js";

/**
 * Returns the filesystem path for a given object hash.
 * Uses a 2-char prefix directory (like git).
 */
function objectPath(storeDir: string, hash: string): string {
  const prefix = hash.slice(0, 2);
  const rest = hash.slice(2);
  return join(storeDir, "objects", prefix, rest);
}

/**
 * Hashes the object, writes its JSON to the content-addressable store,
 * and returns the SHA-256 hash.
 */
export function writeObject(
  storeDir: string,
  obj: Record<string, unknown>,
): string {
  const hash = hashObject(obj);
  const filePath = objectPath(storeDir, hash);

  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(obj), "utf-8");

  return hash;
}

/**
 * Reads and parses a stored object by hash.
 * Returns null if the object does not exist.
 */
export function readObject(
  storeDir: string,
  hash: string,
): Record<string, unknown> | null {
  const filePath = objectPath(storeDir, hash);
  if (!existsSync(filePath)) return null;

  const raw = readFileSync(filePath, "utf-8");
  return JSON.parse(raw) as Record<string, unknown>;
}

/**
 * Checks whether an object with the given hash exists in the store.
 */
export function objectExists(storeDir: string, hash: string): boolean {
  return existsSync(objectPath(storeDir, hash));
}
