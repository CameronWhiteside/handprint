import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore } from "../../src/commands/init.js";
import { sealHandprint } from "../../src/commands/seal.js";
import { resolveHandprint } from "../../src/commands/resolve.js";
import { exportHandprints } from "../../src/commands/export.js";
import { HandprintType } from "../../src/model/handprint.js";
import { ResolutionStatus } from "../../src/model/resolution.js";

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

  const minimalInput = {
    type: HandprintType.Direction,
    intent: "Ship the MVP by Friday",
    risk: "May miss edge cases",
    context: "Sprint planning session",
  };

  it("exports all handprints as JSON", () => {
    sealHandprint(repoRoot, minimalInput);
    sealHandprint(repoRoot, {
      ...minimalInput,
      type: HandprintType.Override,
      intent: "Override decision",
    });

    const result = exportHandprints(repoRoot);

    expect(result.version).toBe("0.1.0");
    expect(result.exportedAt).toBeTruthy();
    expect(result.handprints).toHaveLength(2);
    expect(result.handprints[0].intent).toBe("Ship the MVP by Friday");
    expect(result.handprints[1].intent).toBe("Override decision");
    expect(result.handprints[0].resolutions).toEqual([]);
    expect(result.handprints[1].resolutions).toEqual([]);
  });

  it("includes resolutions linked to their handprints", () => {
    const hash1 = sealHandprint(repoRoot, minimalInput);
    sealHandprint(repoRoot, {
      ...minimalInput,
      type: HandprintType.Override,
      intent: "Override decision",
    });

    resolveHandprint(repoRoot, {
      handprintRef: hash1,
      status: ResolutionStatus.Validated,
      body: "MVP shipped successfully",
      learnings: ["Edge cases were minimal"],
    });

    const result = exportHandprints(repoRoot);

    expect(result.handprints).toHaveLength(2);

    const hp1 = result.handprints.find(
      (h) => h.intent === "Ship the MVP by Friday",
    );
    expect(hp1).toBeDefined();
    expect(hp1!.resolutions).toHaveLength(1);
    expect(hp1!.resolutions[0].status).toBe("validated");
    expect(hp1!.resolutions[0].body).toBe("MVP shipped successfully");
    expect(hp1!.resolutions[0].handprintHash).toBe(hash1);

    const hp2 = result.handprints.find(
      (h) => h.intent === "Override decision",
    );
    expect(hp2).toBeDefined();
    expect(hp2!.resolutions).toEqual([]);
  });

  it("returns empty handprints array when none exist", () => {
    const result = exportHandprints(repoRoot);

    expect(result.version).toBe("0.1.0");
    expect(result.exportedAt).toBeTruthy();
    expect(result.handprints).toEqual([]);
  });
});
