import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeObject, readObject, objectExists } from "../../src/store/objects.js";

describe("object store", () => {
  let storeDir: string;

  afterEach(() => {
    if (storeDir) {
      rmSync(storeDir, { recursive: true, force: true });
    }
  });

  it("writeObject returns a 64-char SHA-256 hash and stores the file", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const obj = { type: "handprint", title: "test decision" };
    const hash = writeObject(storeDir, obj);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(objectExists(storeDir, hash)).toBe(true);
  });

  it("readObject returns the stored object", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const obj = { type: "handprint", title: "test decision", weight: 42 };
    const hash = writeObject(storeDir, obj);
    const result = readObject(storeDir, hash);

    expect(result).toEqual(obj);
  });

  it("readObject returns null for a missing hash", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const fakeHash = "a".repeat(64);
    const result = readObject(storeDir, fakeHash);

    expect(result).toBeNull();
  });

  it("objectExists returns false for a missing hash", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const fakeHash = "b".repeat(64);

    expect(objectExists(storeDir, fakeHash)).toBe(false);
  });

  it("stores files in 2-char prefix subdirectories", () => {
    storeDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    const obj = { hello: "world" };
    const hash = writeObject(storeDir, obj);

    const prefix = hash.slice(0, 2);
    const rest = hash.slice(2);
    const expectedPath = join(storeDir, "objects", prefix, rest);

    expect(existsSync(expectedPath)).toBe(true);
  });
});
