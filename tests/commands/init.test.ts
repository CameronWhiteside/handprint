import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { initStore, HANDPRINT_DIR } from "../../src/commands/init.js";

describe("initStore", () => {
  let repoRoot: string;

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  it("creates .handprint/ with objects/, refs/, staging/ subdirs", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    expect(existsSync(join(hpDir, "objects"))).toBe(true);
    expect(existsSync(join(hpDir, "refs"))).toBe(true);
    expect(existsSync(join(hpDir, "staging"))).toBe(true);
  });

  it("creates config.json with version field", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const configPath = join(repoRoot, HANDPRINT_DIR, "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.version).toBe("0.1.0");
    expect(config.createdAt).toBeDefined();
  });

  it("refuses to init if .handprint/ already exists", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    mkdirSync(join(repoRoot, HANDPRINT_DIR));

    expect(() => initStore(repoRoot)).toThrow("already initialized");
  });

  it("returns the path to .handprint/", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    const result = initStore(repoRoot);

    expect(result).toBe(join(repoRoot, HANDPRINT_DIR));
  });
});
