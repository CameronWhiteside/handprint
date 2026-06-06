import { createHash } from "node:crypto";

/**
 * Recursively sorts object keys to produce a deterministic JSON string,
 * then returns its SHA-256 hex digest.
 */
export function hashObject(obj: Record<string, unknown>): string {
  const canonical = canonicalize(obj);
  return createHash("sha256").update(canonical).digest("hex");
}

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return "[" + value.map(canonicalize).join(",") + "]";
  }

  const sorted = Object.keys(value as Record<string, unknown>).sort();
  const entries = sorted.map(
    (key) =>
      JSON.stringify(key) +
      ":" +
      canonicalize((value as Record<string, unknown>)[key]),
  );
  return "{" + entries.join(",") + "}";
}
