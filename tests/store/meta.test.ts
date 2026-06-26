import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { writeMeta, readMeta, listAllMeta, metaForSeal } from "../../src/store/meta.js";
import type { DecisionMeta } from "../../src/model/meta.js";

describe("store/meta", () => {
  let storeDir: string;

  afterEach(() => {
    if (storeDir) {
      rmSync(storeDir, { recursive: true, force: true });
    }
  });

  function makeMeta(overrides?: Partial<DecisionMeta>): DecisionMeta {
    return {
      seal: "abc123def456abc123def456abc123def456abc123def456abc123def456abcd",
      type: "choice",
      subtype: "override",
      intent: "Use edge JWT instead of gateway",
      risk: "Edge tokens may be harder to revoke",
      context: "auth-service",
      confidence: 0.9,
      horizon: null,
      anchors: [],
      source: "claude-code",
      status: "open",
      resolutions: [],
      ...overrides,
    };
  }

  it("writes and reads a meta entry", () => {
    storeDir = mkdtempSync(join(tmpdir(), "hp-meta-"));
    const meta = makeMeta();
    const hash = writeMeta(storeDir, meta);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);

    const read = readMeta(storeDir, hash);
    expect(read).not.toBeNull();
    expect(read!.intent).toBe("Use edge JWT instead of gateway");
    expect(read!.type).toBe("choice");
    expect(read!.subtype).toBe("override");
  });

  it("returns null for non-existent hash", () => {
    storeDir = mkdtempSync(join(tmpdir(), "hp-meta-"));
    const read = readMeta(storeDir, "0000000000000000000000000000000000000000000000000000000000000000");
    expect(read).toBeNull();
  });

  it("lists all meta entries", () => {
    storeDir = mkdtempSync(join(tmpdir(), "hp-meta-"));
    writeMeta(storeDir, makeMeta({ intent: "first" }));
    writeMeta(storeDir, makeMeta({ intent: "second" }));
    writeMeta(storeDir, makeMeta({ intent: "third" }));

    const all = listAllMeta(storeDir);
    expect(all.length).toBe(3);
    const intents = all.map((m) => m.intent).sort();
    expect(intents).toEqual(["first", "second", "third"]);
  });

  it("returns empty array when no meta dir exists", () => {
    storeDir = mkdtempSync(join(tmpdir(), "hp-meta-"));
    const all = listAllMeta(storeDir);
    expect(all).toEqual([]);
  });

  it("filters meta by seal hash", () => {
    storeDir = mkdtempSync(join(tmpdir(), "hp-meta-"));
    const sealA = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
    const sealB = "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb";

    writeMeta(storeDir, makeMeta({ seal: sealA, intent: "a1" }));
    writeMeta(storeDir, makeMeta({ seal: sealA, intent: "a2" }));
    writeMeta(storeDir, makeMeta({ seal: sealB, intent: "b1" }));

    const forA = metaForSeal(storeDir, sealA);
    expect(forA.length).toBe(2);
    expect(forA.every((m) => m.seal === sealA)).toBe(true);

    const forB = metaForSeal(storeDir, sealB);
    expect(forB.length).toBe(1);
    expect(forB[0].intent).toBe("b1");
  });
});
