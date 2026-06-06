import { describe, it, expect, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  configPath,
} from "../../src/commands/config.js";
import { HANDPRINT_DIR } from "../../src/commands/init.js";

describe("config", () => {
  let repoRoot: string;

  afterEach(() => {
    if (repoRoot) {
      rmSync(repoRoot, { recursive: true, force: true });
    }
  });

  function writeRawConfig(root: string, data: Record<string, unknown>): void {
    const hpDir = join(root, HANDPRINT_DIR);
    mkdirSync(hpDir, { recursive: true });
    writeFileSync(join(hpDir, "config.json"), JSON.stringify(data, null, 2));
  }

  describe("configPath", () => {
    it("returns path to .handprint/config.json", () => {
      expect(configPath("/some/repo")).toBe("/some/repo/.handprint/config.json");
    });
  });

  describe("loadConfig", () => {
    it("throws if not initialized", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      expect(() => loadConfig(repoRoot)).toThrow("not initialized");
    });

    it("returns full config with defaults merged for legacy config", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });

      const config = loadConfig(repoRoot);
      expect(config.version).toBe("0.1.0");
      expect(config.createdAt).toBe("2026-01-01T00:00:00.000Z");
      expect(config.identity).toBeDefined();
      expect(config.identity.handle).toBeDefined();
      expect(config.remote).toBeDefined();
      expect(config.remote.type).toBe("cloudflare-kv");
      expect(config.protocol).toBeDefined();
      expect(config.protocol.calibration.weights.validated).toBe(1.0);
    });

    it("preserves existing protocol overrides while merging defaults", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, {
        version: "0.1.0",
        createdAt: "2026-01-01T00:00:00.000Z",
        protocol: {
          calibration: {
            weights: { validated: 0.9, partial: 0.5, revised: 0.25, invalidated: 0.0 },
          },
        },
      });

      const config = loadConfig(repoRoot);
      // Overridden value preserved
      expect(config.protocol.calibration.weights.validated).toBe(0.9);
      // Default filled in for missing nested key
      expect(config.protocol.calibration.minResolved).toBe(5);
      // Other sections get defaults
      expect(config.protocol.heatmap.weeks).toBe(52);
    });
  });

  describe("saveConfig", () => {
    it("writes config to disk and can be re-loaded", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });

      const loaded = loadConfig(repoRoot);
      loaded.identity.handle = "@testuser";
      saveConfig(repoRoot, loaded);

      const reloaded = loadConfig(repoRoot);
      expect(reloaded.identity.handle).toBe("@testuser");
    });
  });

  describe("getConfigValue", () => {
    it("reads top-level fields", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      expect(getConfigValue(config, "version")).toBe("0.1.0");
    });

    it("reads nested paths", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      expect(getConfigValue(config, "protocol.calibration.weights.validated")).toBe(1.0);
      expect(getConfigValue(config, "protocol.heatmap.weeks")).toBe(52);
    });

    it("returns undefined for non-existent paths", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      expect(getConfigValue(config, "nonexistent.path")).toBeUndefined();
    });
  });

  describe("setConfigValue", () => {
    it("sets nested paths", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      const updated = setConfigValue(config, "protocol.calibration.weights.validated", 0.8);
      expect(getConfigValue(updated, "protocol.calibration.weights.validated")).toBe(0.8);
    });

    it("does not mutate the original config", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      setConfigValue(config, "protocol.calibration.weights.validated", 0.8);
      expect(config.protocol.calibration.weights.validated).toBe(1.0);
    });

    it("coerces 'true' to boolean true", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      const updated = setConfigValue(config, "protocol.anchors.linkPRs", "true");
      expect(getConfigValue(updated, "protocol.anchors.linkPRs")).toBe(true);
    });

    it("coerces 'false' to boolean false", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      const updated = setConfigValue(config, "protocol.anchors.linkPRs", "false");
      expect(getConfigValue(updated, "protocol.anchors.linkPRs")).toBe(false);
    });

    it("coerces numeric strings to numbers", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      const updated = setConfigValue(config, "protocol.calibration.minResolved", "10");
      expect(getConfigValue(updated, "protocol.calibration.minResolved")).toBe(10);
    });

    it("creates intermediate objects if they don't exist", () => {
      repoRoot = mkdtempSync(join(tmpdir(), "handprint-config-"));
      writeRawConfig(repoRoot, { version: "0.1.0", createdAt: "2026-01-01T00:00:00.000Z" });
      const config = loadConfig(repoRoot);

      const updated = setConfigValue(config, "custom.nested.key", "value");
      expect(getConfigValue(updated, "custom.nested.key")).toBe("value");
    });
  });
});
