import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setRef, getRef, listRefs } from "../../src/store/refs.js";

describe("refs", () => {
  let storeDir: string;

  afterEach(() => {
    if (storeDir) {
      rmSync(storeDir, { recursive: true, force: true });
    }
  });

  it("setRef creates a ref file and getRef reads it back", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const hash = "a1b2c3d4".repeat(8);

    setRef(storeDir, "HEAD", hash);
    const result = getRef(storeDir, "HEAD");

    expect(result).toBe(hash);
  });

  it("getRef returns null for a missing ref", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const result = getRef(storeDir, "nonexistent");

    expect(result).toBeNull();
  });

  it("listRefs returns all refs", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const hash1 = "aa".repeat(32);
    const hash2 = "bb".repeat(32);

    setRef(storeDir, "HEAD", hash1);
    setRef(storeDir, "latest-seal", hash2);

    const refs = listRefs(storeDir);

    expect(refs).toHaveLength(2);
    expect(refs).toContainEqual({ name: "HEAD", hash: hash1 });
    expect(refs).toContainEqual({ name: "latest-seal", hash: hash2 });
  });

  it("listRefs returns empty array when no refs exist", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const refs = listRefs(storeDir);

    expect(refs).toEqual([]);
  });
});
