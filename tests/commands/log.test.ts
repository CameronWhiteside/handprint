import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { sealChunk } from "../../src/commands/seal.js";
import { listSeals, listDecisions } from "../../src/commands/log.js";
import { writeMeta } from "../../src/store/meta.js";
import type { DecisionMeta } from "../../src/model/meta.js";

describe("listSeals", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-log-"));
    initStore(repoRoot);
  });

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  const minimalInput = {
    ts: "2026-06-26T10:00:00Z",
    session: "session-log",
    project: "test-project",
    author: "Test User",
    plaintext: "Ship the MVP by Friday",
  };

  it("returns empty array when no seals exist", () => {
    const entries = listSeals(repoRoot);
    expect(entries).toEqual([]);
  });

  it("returns all sealed entries in order", () => {
    const hash1 = sealChunk(repoRoot, minimalInput);
    const hash2 = sealChunk(repoRoot, {
      ...minimalInput,
      plaintext: "Second conversation",
    });

    const entries = listSeals(repoRoot);
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe(hash1);
    expect(entries[1].hash).toBe(hash2);
  });

  it("each entry includes its hash and seal data", () => {
    const hash = sealChunk(repoRoot, minimalInput);
    const entries = listSeals(repoRoot);

    expect(entries).toHaveLength(1);
    expect(entries[0].hash).toBe(hash);
    expect(entries[0].seal.session).toBe("session-log");
    expect(entries[0].seal.project).toBe("test-project");
  });
});

describe("listDecisions", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-log-"));
    initStore(repoRoot);
  });

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  function makeMeta(overrides?: Partial<DecisionMeta>): DecisionMeta {
    return {
      seal: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      type: "vision",
      intent: "Ship the MVP",
      risk: "May miss edge cases",
      context: "sprint-planning",
      confidence: 0.9,
      horizon: null,
      anchors: [],
      source: "claude-code",
      status: "open",
      resolutions: [],
      ...overrides,
    };
  }

  it("returns empty when no meta exists", () => {
    const metas = listDecisions(repoRoot);
    expect(metas).toEqual([]);
  });

  it("returns all meta entries", () => {
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    writeMeta(hpDir, makeMeta({ intent: "first" }));
    writeMeta(hpDir, makeMeta({ intent: "second" }));

    const metas = listDecisions(repoRoot);
    expect(metas).toHaveLength(2);
  });

  it("filters by type", () => {
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    writeMeta(hpDir, makeMeta({ type: "vision", intent: "vision one" }));
    writeMeta(hpDir, makeMeta({ type: "choice", intent: "choice one" }));
    writeMeta(hpDir, makeMeta({ type: "method", intent: "method one" }));

    const choices = listDecisions(repoRoot, { type: "choice" });
    expect(choices).toHaveLength(1);
    expect(choices[0].intent).toBe("choice one");
  });
});
