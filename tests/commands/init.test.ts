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

  it("creates .handprint/ with objects/, refs/, meta/, keys/ subdirs", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    expect(existsSync(join(hpDir, "objects"))).toBe(true);
    expect(existsSync(join(hpDir, "refs"))).toBe(true);
    expect(existsSync(join(hpDir, "meta"))).toBe(true);
    expect(existsSync(join(hpDir, "keys"))).toBe(true);
  });

  it("generates Ed25519 signing keypair", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const pubKey = readFileSync(join(hpDir, "keys", "signing.pub"), "utf-8");
    const privKey = readFileSync(join(hpDir, "keys", "signing.key"), "utf-8");
    expect(pubKey).toContain("BEGIN PUBLIC KEY");
    expect(privKey).toContain("BEGIN PRIVATE KEY");
  });

  it("generates AES-256 encryption key as hex", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const hpDir = join(repoRoot, HANDPRINT_DIR);
    const encKey = readFileSync(join(hpDir, "keys", "encryption.key"), "utf-8").trim();
    expect(encKey).toMatch(/^[a-f0-9]{64}$/);
  });

  it("creates config.json with version, identity, remote, and protocol fields", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const configPath = join(repoRoot, HANDPRINT_DIR, "config.json");
    expect(existsSync(configPath)).toBe(true);

    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(config.version).toBe("0.1.0");
    expect(config.createdAt).toBeDefined();
    expect(config.identity).toBeDefined();
    expect(config.identity.handle).toBeDefined();
    expect(config.identity.name).toBeDefined();
    expect(config.identity.email).toBeDefined();
    expect(config.remote).toEqual({ type: "cloudflare-kv", accountId: "", namespaceId: null });
    expect(config.protocol).toBeDefined();
    expect(config.protocol.calibration).toBeDefined();
    expect(config.protocol.calibration.weights.validated).toBe(1.0);
    expect(config.protocol.heatmap.weeks).toBe(52);
  });

  it("creates taxonomy.json", () => {
    repoRoot = mkdtempSync(join(tmpdir(), "handprint-init-"));
    initStore(repoRoot);

    const taxPath = join(repoRoot, HANDPRINT_DIR, "taxonomy.json");
    expect(existsSync(taxPath)).toBe(true);

    const tax = JSON.parse(readFileSync(taxPath, "utf-8"));
    expect(tax.v).toBe(1);
    expect(tax.types.vision).toBeDefined();
    expect(tax.types.choice).toBeDefined();
    expect(tax.types.method).toBeDefined();
    expect(tax.types.choice.subtypes).toContain("override");
    expect(tax.aliases.direction).toEqual({ type: "choice", subtype: "direction" });
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
