import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { sealHandprint } from "../../src/commands/seal.js";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { readObject } from "../../src/store/objects.js";
import { HandprintType } from "../../src/model/handprint.js";

describe("sealHandprint", () => {
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
    type: HandprintType.Direction,
    intent: "Ship the MVP by Friday",
    risk: "May miss edge cases",
    context: "Sprint planning session",
  };

  it("seals a handprint and returns its hash", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("persists the handprint to the object store", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const stored = readObject(hpDir, hash);

    expect(stored).not.toBeNull();
    expect(stored!.intent).toBe("Ship the MVP by Friday");
    expect(stored!.type).toBe("direction");
  });

  it("appends hash to the log index file", () => {
    const hash1 = sealHandprint(repoRoot, minimalInput);
    const hash2 = sealHandprint(repoRoot, {
      ...minimalInput,
      intent: "Different intent for unique hash",
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
      expect(() => sealHandprint(emptyRoot, minimalInput)).toThrow(
        "not initialized",
      );
    } finally {
      rmSync(emptyRoot, { recursive: true, force: true });
    }
  });
});
