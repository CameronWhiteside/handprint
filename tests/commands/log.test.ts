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
    type: HandprintType.Vision,
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
    expect(entries[0].type).toBe(HandprintType.Vision);
  });

  it("filters by type", () => {
    sealHandprint(repoRoot, minimalInput);
    sealHandprint(repoRoot, {
      ...minimalInput,
      type: HandprintType.Choice,
      intent: "Choice decision",
    });
    sealHandprint(repoRoot, {
      ...minimalInput,
      type: HandprintType.Method,
      intent: "Method decision",
    });

    const choices = listHandprints(repoRoot, {
      type: HandprintType.Choice,
    });
    expect(choices).toHaveLength(1);
    expect(choices[0].intent).toBe("Choice decision");

    const visions = listHandprints(repoRoot, {
      type: HandprintType.Vision,
    });
    expect(visions).toHaveLength(1);
    expect(visions[0].intent).toBe("Ship the MVP by Friday");
  });
});
