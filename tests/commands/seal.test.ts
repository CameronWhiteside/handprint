import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sealChunk } from "../../src/commands/seal.js";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { readObject } from "../../src/store/objects.js";
import { getRef } from "../../src/store/refs.js";
import { decrypt, verifySignature } from "../../src/crypto/keys.js";
import { hashObject } from "../../src/store/hash.js";
import type { Seal } from "../../src/model/seal.js";

describe("sealChunk", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-seal-"));
    initStore(repoRoot);
  });

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  const minimalInput = {
    ts: "2026-06-26T10:00:00Z",
    session: "session-abc",
    project: "test-project",
    author: "Test User",
    plaintext: "User asked to build an auth service. Assistant suggested three approaches.",
  };

  it("seals a chunk and returns its hash", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("persists the seal to the object store with encrypted payload", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const stored = readObject(hpDir, hash);

    expect(stored).not.toBeNull();
    expect(stored!.v).toBe(1);
    expect(stored!.session).toBe("session-abc");
    expect(stored!.project).toBe("test-project");
    expect(stored!.payload).toBeTruthy();
    expect(stored!.signature).toBeTruthy();
    expect(stored!.pubkey).toBeTruthy();

    // Payload should be encrypted, not plaintext
    expect(stored!.payload).not.toContain("auth service");
  });

  it("decrypts payload back to sanitized plaintext", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const stored = readObject(hpDir, hash) as unknown as Seal;

    const encKey = Buffer.from(
      readFileSync(join(hpDir, "keys", "encryption.key"), "utf-8").trim(),
      "hex",
    );
    const decrypted = decrypt(stored.payload, encKey);
    expect(decrypted).toContain("auth service");
  });

  it("signature is valid against the embedded pubkey", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const stored = readObject(hpDir, hash) as unknown as Seal;

    const { signature, ...sealData } = stored;
    const canonical = hashObject(sealData as unknown as Record<string, unknown>);
    expect(verifySignature(canonical, signature, stored.pubkey)).toBe(true);
  });

  it("appends hash to the log index file", () => {
    const hash1 = sealChunk(repoRoot, minimalInput);
    const hash2 = sealChunk(repoRoot, {
      ...minimalInput,
      plaintext: "Different conversation content",
    });

    const logPath = join(repoRoot, HANDPRINT_DIR, "log");
    const logContent = readFileSync(logPath, "utf-8");
    const lines = logContent.split("\n").filter(Boolean);

    expect(lines).toContain(hash1);
    expect(lines).toContain(hash2);
    expect(lines.length).toBe(2);
  });

  it("throws if .handprint/ does not exist", () => {
    const emptyRoot = mkdtempSync(join(tmpdir(), "handprint-seal-empty-"));
    try {
      expect(() => sealChunk(emptyRoot, minimalInput)).toThrow("not initialized");
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });

  it("first sealed chunk has parent: null", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const stored = readObject(hpDir, hash);

    expect(stored).not.toBeNull();
    expect(stored!.parent).toBeNull();
  });

  it("second sealed chunk has parent equal to first hash", () => {
    const hash1 = sealChunk(repoRoot, minimalInput);
    const hash2 = sealChunk(repoRoot, {
      ...minimalInput,
      plaintext: "Second conversation",
    });

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const stored = readObject(hpDir, hash2);

    expect(stored).not.toBeNull();
    expect(stored!.parent).toBe(hash1);
  });

  it("updates HEAD ref after each seal", () => {
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    expect(getRef(hpDir, "HEAD")).toBeNull();

    const hash1 = sealChunk(repoRoot, minimalInput);
    expect(getRef(hpDir, "HEAD")).toBe(hash1);

    const hash2 = sealChunk(repoRoot, {
      ...minimalInput,
      plaintext: "Second conversation",
    });
    expect(getRef(hpDir, "HEAD")).toBe(hash2);
  });

  it("chain is walkable from HEAD back to genesis", () => {
    const hash1 = sealChunk(repoRoot, minimalInput);
    const hash2 = sealChunk(repoRoot, {
      ...minimalInput,
      plaintext: "Second conversation",
    });
    const hash3 = sealChunk(repoRoot, {
      ...minimalInput,
      plaintext: "Third conversation",
    });

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    expect(getRef(hpDir, "HEAD")).toBe(hash3);

    const obj3 = readObject(hpDir, hash3);
    expect(obj3!.parent).toBe(hash2);

    const obj2 = readObject(hpDir, hash2);
    expect(obj2!.parent).toBe(hash1);

    const obj1 = readObject(hpDir, hash1);
    expect(obj1!.parent).toBeNull();
  });
});
