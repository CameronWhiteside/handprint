import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { sealChunk } from "../../src/commands/seal.js";
import { showSeal } from "../../src/commands/show.js";
import { writeMeta } from "../../src/store/meta.js";
import type { DecisionMeta } from "../../src/model/meta.js";

describe("showSeal", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-show-"));
    initStore(repoRoot);
  });

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  const minimalInput = {
    ts: "2026-06-26T10:00:00Z",
    session: "session-show",
    project: "test-project",
    author: "Test User",
    plaintext: "User asked to build an auth service.",
  };

  it("returns full seal by hash", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const detail = showSeal(repoRoot, hash);

    expect(detail).not.toBeNull();
    expect(detail!.hash).toBe(hash);
    expect(detail!.seal.session).toBe("session-show");
    expect(detail!.seal.project).toBe("test-project");
    expect(detail!.seal.v).toBe(1);
  });

  it("resolves short hash prefix (min 7 chars)", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const shortRef = hash.slice(0, 7);
    const detail = showSeal(repoRoot, shortRef);

    expect(detail).not.toBeNull();
    expect(detail!.hash).toBe(hash);
  });

  it("returns null for unknown hash", () => {
    const detail = showSeal(
      repoRoot,
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    );
    expect(detail).toBeNull();
  });

  it("includes associated meta entries", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);

    const meta: DecisionMeta = {
      seal: hash,
      type: "choice",
      subtype: "override",
      intent: "Use edge JWT",
      risk: "Revocation complexity",
      context: "auth",
      confidence: 0.9,
      horizon: null,
      anchors: [],
      source: "claude-code",
      status: "open",
      resolutions: [],
    };
    writeMeta(hpDir, meta);

    const detail = showSeal(repoRoot, hash);
    expect(detail).not.toBeNull();
    expect(detail!.meta).toHaveLength(1);
    expect(detail!.meta[0].intent).toBe("Use edge JWT");
  });

  it("decrypts payload when requested", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const detail = showSeal(repoRoot, hash, { decryptPayload: true });

    expect(detail).not.toBeNull();
    expect(detail!.decryptedPayload).toBeDefined();
    expect(detail!.decryptedPayload).toContain("auth service");
  });

  it("does not decrypt by default", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const detail = showSeal(repoRoot, hash);

    expect(detail).not.toBeNull();
    expect(detail!.decryptedPayload).toBeUndefined();
  });
});
