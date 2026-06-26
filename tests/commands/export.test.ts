import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { sealChunk } from "../../src/commands/seal.js";
import { exportHandprints } from "../../src/commands/export.js";
import { writeMeta } from "../../src/store/meta.js";
import type { DecisionMeta } from "../../src/model/meta.js";

describe("exportHandprints", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-export-"));
    initStore(repoRoot);
  });

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("exports seals and meta as JSON", () => {
    const hash1 = sealChunk(repoRoot, {
      ts: "2026-06-26T10:00:00Z",
      session: "s1",
      project: "test",
      author: "Test",
      plaintext: "First conversation",
    });

    const hash2 = sealChunk(repoRoot, {
      ts: "2026-06-26T11:00:00Z",
      session: "s2",
      project: "test",
      author: "Test",
      plaintext: "Second conversation",
    });

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const meta: DecisionMeta = {
      seal: hash1,
      type: "vision",
      intent: "Build auth service",
      risk: "Complexity",
      context: "auth",
      confidence: 0.9,
      horizon: null,
      anchors: [],
      source: "claude-code",
      status: "open",
      resolutions: [],
    };
    writeMeta(hpDir, meta);

    const result = exportHandprints(repoRoot);

    expect(result.version).toBe("0.1.0");
    expect(result.exportedAt).toBeTruthy();
    expect(result.seals).toHaveLength(2);
    expect(result.meta).toHaveLength(1);
    expect(result.meta[0].intent).toBe("Build auth service");
  });

  it("returns empty arrays when nothing exists", () => {
    const result = exportHandprints(repoRoot);

    expect(result.version).toBe("0.1.0");
    expect(result.exportedAt).toBeTruthy();
    expect(result.seals).toEqual([]);
    expect(result.meta).toEqual([]);
  });
});
