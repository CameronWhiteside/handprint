import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sealChunk } from "../../src/commands/seal.js";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { verifyChain } from "../../src/commands/verify.js";
import { hashObject } from "../../src/store/hash.js";
import { setRef } from "../../src/store/refs.js";

describe("verifyChain", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-verify-"));
    initStore(repoRoot);
  });

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  const minimalInput = {
    ts: "2026-06-26T10:00:00Z",
    session: "session-verify",
    project: "test-project",
    author: "Test User",
    plaintext: "Ship the MVP",
  };

  it("returns valid with chainLength 0 for empty store", () => {
    const result = verifyChain(repoRoot);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(0);
    expect(result.head).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it("returns valid for a single-entry chain", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(1);
    expect(result.head).toBe(hash);
    expect(result.errors).toEqual([]);
  });

  it("returns valid for a multi-entry chain", () => {
    sealChunk(repoRoot, minimalInput);
    sealChunk(repoRoot, { ...minimalInput, plaintext: "Second" });
    const hash3 = sealChunk(repoRoot, { ...minimalInput, plaintext: "Third" });

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(3);
    expect(result.head).toBe(hash3);
    expect(result.errors).toEqual([]);
  });

  it("detects tampered content (hash mismatch)", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    // Tamper with the object file directly
    const prefix = hash.slice(0, 2);
    const rest = hash.slice(2);
    const objPath = join(hpDir, "objects", prefix, rest);
    const obj = JSON.parse(readFileSync(objPath, "utf-8"));
    obj.project = "TAMPERED";
    writeFileSync(objPath, JSON.stringify(obj), "utf-8");

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].hash).toBe(hash);
    expect(result.errors[0].error).toBe("hash mismatch");
  });

  it("detects invalid signature", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    // Read the original object
    const prefix = hash.slice(0, 2);
    const rest = hash.slice(2);
    const objPath = join(hpDir, "objects", prefix, rest);
    const obj = JSON.parse(readFileSync(objPath, "utf-8"));

    // Corrupt signature
    obj.signature = "AAAA" + obj.signature.slice(4);

    // Write as new object with its own hash
    const newHash = hashObject(obj);
    const newPrefix = newHash.slice(0, 2);
    const newRest = newHash.slice(2);
    mkdirSync(join(hpDir, "objects", newPrefix), { recursive: true });
    writeFileSync(
      join(hpDir, "objects", newPrefix, newRest),
      JSON.stringify(obj),
      "utf-8",
    );

    // Point HEAD to the tampered object
    setRef(hpDir, "HEAD", newHash);

    const result = verifyChain(repoRoot);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.error === "invalid signature")).toBe(true);
  });

  it("detects missing object", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    const prefix = hash.slice(0, 2);
    const rest = hash.slice(2);
    const objPath = join(hpDir, "objects", prefix, rest);
    rmSync(objPath);

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].hash).toBe(hash);
    expect(result.errors[0].error).toBe("object missing");
  });

  it("detects missing parent object in chain", () => {
    const hash1 = sealChunk(repoRoot, minimalInput);
    sealChunk(repoRoot, { ...minimalInput, plaintext: "Second" });
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    const prefix = hash1.slice(0, 2);
    const rest = hash1.slice(2);
    const objPath = join(hpDir, "objects", prefix, rest);
    rmSync(objPath);

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.error === "parent missing")).toBe(true);
  });

  it("throws if store not initialized", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "handprint-verify-empty-"));
    try {
      expect(() => verifyChain(emptyRoot)).toThrow("not initialized");
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
