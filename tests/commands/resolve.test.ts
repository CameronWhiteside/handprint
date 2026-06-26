import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";
import { sealHandprint } from "../../src/commands/seal.js";
import { resolveHandprint } from "../../src/commands/resolve.js";
import { showHandprint } from "../../src/commands/show.js";
import { readObject } from "../../src/store/objects.js";
import { HandprintType } from "../../src/model/handprint.js";
import { ResolutionStatus } from "../../src/model/resolution.js";

describe("resolveHandprint", () => {
  let repoRoot: string;

  beforeEach(() => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-resolve-"));
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

  it("creates a resolution object linked to the handprint", () => {
    const hpHash = sealHandprint(repoRoot, minimalInput);
    const resHash = resolveHandprint(repoRoot, {
      handprintRef: hpHash,
      status: ResolutionStatus.Validated,
      body: "MVP shipped successfully",
      learnings: ["Edge cases were minimal"],
    });

    expect(resHash).toMatch(/^[a-f0-9]{64}$/);

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const resolution = readObject(hpDir, resHash);
    expect(resolution).not.toBeNull();
    expect(resolution!.handprintHash).toBe(hpHash);
    expect(resolution!.status).toBe("validated");
    expect(resolution!.body).toBe("MVP shipped successfully");
    expect(resolution!.learnings).toEqual(["Edge cases were minimal"]);
  });

  it("updates the handprint status to resolved", () => {
    const hpHash = sealHandprint(repoRoot, minimalInput);
    resolveHandprint(repoRoot, {
      handprintRef: hpHash,
      status: ResolutionStatus.Validated,
      body: "Done",
    });

    const hp = showHandprint(repoRoot, hpHash);
    expect(hp).not.toBeNull();
    expect(hp!.status).toBe("resolved");
  });

  it("writes resolution hash to resolutions index", () => {
    const hpHash = sealHandprint(repoRoot, minimalInput);
    const resHash = resolveHandprint(repoRoot, {
      handprintRef: hpHash,
      status: ResolutionStatus.Partial,
      body: "Partially done",
    });

    const resPath = join(repoRoot, HANDPRINT_DIR, "resolutions");
    expect(existsSync(resPath)).toBe(true);

    const content = readFileSync(resPath, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    expect(lines).toContain(resHash);
  });

  it("throws for unknown handprint ref", () => {
    expect(() =>
      resolveHandprint(repoRoot, {
        handprintRef:
          "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
        status: ResolutionStatus.Invalidated,
        body: "Not found",
      }),
    ).toThrow();
  });
});
