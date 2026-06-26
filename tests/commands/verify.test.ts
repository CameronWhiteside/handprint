import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { sealHandprint } from "../../src/commands/seal.js";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { verifyChain } from "../../src/commands/verify.js";
import { HandprintType } from "../../src/model/handprint.js";

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
    type: HandprintType.Vision,
    intent: "Ship the MVP",
    risk: "May miss edge cases",
    context: "Sprint planning",
  };

  it("returns valid with chainLength 0 for empty store", () => {
    const result = verifyChain(repoRoot);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(0);
    expect(result.head).toBeNull();
    expect(result.errors).toEqual([]);
  });

  it("returns valid for a single-entry chain", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(1);
    expect(result.head).toBe(hash);
    expect(result.errors).toEqual([]);
  });

  it("returns valid for a multi-entry chain", () => {
    sealHandprint(repoRoot, minimalInput);
    sealHandprint(repoRoot, { ...minimalInput, intent: "Second" });
    const hash3 = sealHandprint(repoRoot, { ...minimalInput, intent: "Third" });

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(3);
    expect(result.head).toBe(hash3);
    expect(result.errors).toEqual([]);
  });

  it("detects tampered content (hash mismatch)", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    // Tamper with the object file directly
    const prefix = hash.slice(0, 2);
    const rest = hash.slice(2);
    const objPath = join(hpDir, "objects", prefix, rest);
    const obj = JSON.parse(readFileSync(objPath, "utf-8"));
    obj.intent = "TAMPERED CONTENT";
    writeFileSync(objPath, JSON.stringify(obj), "utf-8");

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(1);
    expect(result.errors[0].hash).toBe(hash);
    expect(result.errors[0].error).toBe("hash mismatch");
  });

  it("detects missing object", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    // Delete the object file
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
    const hash1 = sealHandprint(repoRoot, minimalInput);
    const hash2 = sealHandprint(repoRoot, { ...minimalInput, intent: "Second" });
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    // Delete the first object (parent of second)
    const prefix = hash1.slice(0, 2);
    const rest = hash1.slice(2);
    const objPath = join(hpDir, "objects", prefix, rest);
    rmSync(objPath);

    const result = verifyChain(repoRoot);

    expect(result.valid).toBe(false);
    // hash2 should be fine, but walking to hash1 should fail
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
