import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore } from "../../src/commands/init.js";
import { sealHandprint } from "../../src/commands/seal.js";
import { showHandprint } from "../../src/commands/show.js";
import { HandprintType } from "../../src/model/handprint.js";

describe("showHandprint", () => {
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
    type: HandprintType.Vision,
    intent: "Ship the MVP by Friday",
    risk: "May miss edge cases",
    context: "Sprint planning session",
  };

  it("returns full handprint by hash", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const detail = showHandprint(repoRoot, hash);

    expect(detail).not.toBeNull();
    expect(detail!.hash).toBe(hash);
    expect(detail!.intent).toBe("Ship the MVP by Friday");
    expect(detail!.type).toBe(HandprintType.Vision);
    expect(detail!.risk).toBe("May miss edge cases");
    expect(detail!.context).toBe("Sprint planning session");
  });

  it("resolves short hash prefix (min 7 chars)", () => {
    const hash = sealHandprint(repoRoot, minimalInput);
    const shortRef = hash.slice(0, 7);
    const detail = showHandprint(repoRoot, shortRef);

    expect(detail).not.toBeNull();
    expect(detail!.hash).toBe(hash);
    expect(detail!.intent).toBe("Ship the MVP by Friday");
  });

  it("returns null for unknown hash", () => {
    const detail = showHandprint(
      repoRoot,
      "deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef",
    );
    expect(detail).toBeNull();
  });
});
