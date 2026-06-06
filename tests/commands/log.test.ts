import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore } from "../../src/commands/init.js";
import { sealHandprint } from "../../src/commands/seal.js";
import { listHandprints } from "../../src/commands/log.js";
import { HandprintType } from "../../src/model/handprint.js";

describe("listHandprints", () => {
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
    type: HandprintType.Direction,
    intent: "Ship the MVP by Friday",
    risk: "May miss edge cases",
    context: "Sprint planning session",
  };

  it("returns empty array when no handprints exist", () => {
    const entries = listHandprints(repoRoot);
    expect(entries).toEqual([]);
  });

  it("returns all sealed handprints in order", () => {
    const hash1 = sealHandprint(repoRoot, minimalInput);
    const hash2 = sealHandprint(repoRoot, {
      ...minimalInput,
      intent: "Second handprint",
    });

    const entries = listHandprints(repoRoot);
    expect(entries).toHaveLength(2);
    expect(entries[0].hash).toBe(hash1);
    expect(entries[1].hash).toBe(hash2);
  });

  it("each entry includes its hash", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const entries = listHandprints(repoRoot);

    expect(entries).toHaveLength(1);
    expect(entries[0].hash).toBe(hash);
    expect(entries[0].intent).toBe("Ship the MVP by Friday");
    expect(entries[0].type).toBe(HandprintType.Direction);
  });

  it("filters by type", () => {
    sealHandprint(repoRoot, minimalInput);
    sealHandprint(repoRoot, {
      ...minimalInput,
      type: HandprintType.Override,
      intent: "Override decision",
    });
    sealHandprint(repoRoot, {
      ...minimalInput,
      type: HandprintType.Constraint,
      intent: "Constraint decision",
    });

    const overrides = listHandprints(repoRoot, {
      type: HandprintType.Override,
    });
    expect(overrides).toHaveLength(1);
    expect(overrides[0].intent).toBe("Override decision");

    const directions = listHandprints(repoRoot, {
      type: HandprintType.Direction,
    });
    expect(directions).toHaveLength(1);
    expect(directions[0].intent).toBe("Ship the MVP by Friday");
  });
});
