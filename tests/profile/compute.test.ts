import { describe, it, expect } from "vitest";
import { computeProfile } from "../../src/profile/compute.js";
import { DEFAULT_PROTOCOL, type HandprintConfig } from "../../src/profile/types.js";
import type { DecisionMeta } from "../../src/model/meta.js";

function makeConfig(overrides?: Partial<HandprintConfig>): HandprintConfig {
  return {
    version: "0.1.0",
    createdAt: "2026-01-01T00:00:00.000Z",
    identity: { handle: "@test", name: "Test User", email: "test@test.com" },
    remote: { type: "cloudflare-kv", accountId: "abc", namespaceId: null },
    protocol: DEFAULT_PROTOCOL,
    ...overrides,
  };
}

function makeMeta(overrides?: Partial<DecisionMeta>): DecisionMeta {
  return {
    seal: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    type: "vision",
    intent: "test intent",
    risk: "test risk",
    context: "test-domain",
    confidence: 0.9,
    horizon: null,
    anchors: [],
    source: "claude-code",
    status: "open",
    resolutions: [],
    ...overrides,
  };
}

const config = makeConfig();

describe("computeProfile", () => {
  describe("typeCounts", () => {
    it("counts entries by type", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ type: "vision" }),
        makeMeta({ type: "vision" }),
        makeMeta({ type: "choice" }),
        makeMeta({ type: "choice" }),
        makeMeta({ type: "method" }),
        makeMeta({ type: "method" }),
        makeMeta({ type: "method" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.typeCounts).toEqual({
        vision: 2,
        choice: 2,
        method: 3,
      });
      expect(profile.total).toBe(7);
    });

    it("returns zeros for empty entries", () => {
      const profile = computeProfile([], config, null);
      expect(profile.typeCounts).toEqual({
        vision: 0,
        choice: 0,
        method: 0,
      });
      expect(profile.total).toBe(0);
    });
  });

  describe("subtypeCounts", () => {
    it("counts entries by subtype", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ type: "choice", subtype: "override" }),
        makeMeta({ type: "choice", subtype: "override" }),
        makeMeta({ type: "choice", subtype: "rejection" }),
        makeMeta({ type: "method", subtype: "tools" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.subtypeCounts).toEqual({
        override: 2,
        rejection: 1,
        tools: 1,
      });
    });

    it("returns empty for entries without subtypes", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ type: "vision" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.subtypeCounts).toEqual({});
    });
  });

  describe("calibration", () => {
    it("computes calibration score with default weights", () => {
      const entries: DecisionMeta[] = [
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "validated", body: "correct", timestamp: "2026-06-02T00:00:00Z" }],
        }),
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "partial", body: "partially", timestamp: "2026-06-02T00:00:00Z" }],
        }),
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "revised", body: "revised", timestamp: "2026-06-02T00:00:00Z" }],
        }),
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "invalidated", body: "wrong", timestamp: "2026-06-02T00:00:00Z" }],
        }),
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "validated", body: "correct", timestamp: "2026-06-02T00:00:00Z" }],
        }),
        makeMeta({ status: "open" }),
      ];

      const profile = computeProfile(entries, config, null);
      // 2*1.0 + 1*0.5 + 1*0.25 + 1*0.0 = 2.75 / 5 = 0.55
      expect(profile.calibration.score).toBeCloseTo(0.55);
      expect(profile.calibration.resolved).toBe(5);
      expect(profile.calibration.open).toBe(1);
      expect(profile.calibration.breakdown).toEqual({
        validated: 2,
        partial: 1,
        revised: 1,
        invalidated: 1,
      });
    });

    it("returns null score when fewer than minResolved entries", () => {
      const entries: DecisionMeta[] = [
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "validated", body: "ok", timestamp: "2026-06-02T00:00:00Z" }],
        }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.calibration.score).toBeNull();
      expect(profile.calibration.resolved).toBe(1);
    });

    it("includes a formula string", () => {
      const entries: DecisionMeta[] = Array.from({ length: 5 }, () =>
        makeMeta({
          status: "resolved",
          resolutions: [{ status: "validated", body: "ok", timestamp: "2026-06-02T00:00:00Z" }],
        }),
      );
      const profile = computeProfile(entries, config, null);
      expect(profile.calibration.formula).toContain("validated");
      expect(typeof profile.calibration.formula).toBe("string");
    });
  });

  describe("domains", () => {
    it("groups by context, sorted descending by count", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ context: "auth" }),
        makeMeta({ context: "auth" }),
        makeMeta({ context: "auth" }),
        makeMeta({ context: "billing" }),
        makeMeta({ context: "billing" }),
        makeMeta({ context: "onboarding" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.domains[0].name).toBe("auth");
      expect(profile.domains[0].count).toBe(3);
      expect(profile.domains[0].percentage).toBeCloseTo(50);
      expect(profile.domains[1].name).toBe("billing");
      expect(profile.domains[1].count).toBe(2);
    });

    it("marks domains at or above strongThreshold as strong", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ context: "auth" }),
        makeMeta({ context: "auth" }),
        ...Array.from({ length: 8 }, () => makeMeta({ context: "billing" })),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.domains.every((d) => d.strong)).toBe(true);
    });

    it("marks low-percentage domains as not strong", () => {
      const entries: DecisionMeta[] = [
        ...Array.from({ length: 100 }, () => makeMeta({ context: "main" })),
        makeMeta({ context: "tiny" }),
      ];
      const profile = computeProfile(entries, config, null);
      const tiny = profile.domains.find((d) => d.name === "tiny");
      expect(tiny).toBeDefined();
      expect(tiny!.strong).toBe(false);
    });
  });

  describe("tools", () => {
    it("groups by source field, sorted descending", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ source: "claude-code" }),
        makeMeta({ source: "claude-code" }),
        makeMeta({ source: "git-commit" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.tools[0].name).toBe("claude-code");
      expect(profile.tools[0].count).toBe(2);
      expect(profile.tools[0].percentage).toBeCloseTo(66.67, 0);
      expect(profile.tools.length).toBe(2);
    });
  });

  describe("featured", () => {
    it("selects entry with most anchors", () => {
      const entries: DecisionMeta[] = [
        makeMeta({
          anchors: [{ label: "repo:x", verified: true }],
          intent: "short",
        }),
        makeMeta({
          anchors: [
            { label: "repo:x", verified: true },
            { label: "branch:main", verified: true },
            { label: "git:abc1234", verified: true },
          ],
          intent: "most anchors",
        }),
        makeMeta({
          anchors: [
            { label: "repo:x", verified: true },
            { label: "branch:main", verified: true },
          ],
          intent: "medium anchors",
        }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.featured).not.toBeNull();
      expect(profile.featured!.strategy).toBe("most-anchors");
    });

    it("returns null for empty entries", () => {
      const profile = computeProfile([], config, null);
      expect(profile.featured).toBeNull();
    });
  });

  describe("repos", () => {
    it("extracts unique repo URLs from anchors", () => {
      const entries: DecisionMeta[] = [
        makeMeta({
          anchors: [
            { label: "repo:https://github.com/test/a.git", verified: true },
            { label: "branch:main", verified: true },
          ],
        }),
        makeMeta({
          anchors: [
            { label: "repo:https://github.com/test/a.git", verified: true },
          ],
        }),
        makeMeta({
          anchors: [
            { label: "repo:https://github.com/test/b.git", verified: true },
          ],
        }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.repos).toHaveLength(2);
      const repoA = profile.repos.find(
        (r) => r.url === "https://github.com/test/a.git",
      );
      const repoB = profile.repos.find(
        (r) => r.url === "https://github.com/test/b.git",
      );
      expect(repoA!.handprintCount).toBe(2);
      expect(repoB!.handprintCount).toBe(1);
    });

    it("returns empty for entries without repo anchors", () => {
      const entries: DecisionMeta[] = [makeMeta({ anchors: [] })];
      const profile = computeProfile(entries, config, null);
      expect(profile.repos).toEqual([]);
    });
  });

  describe("merkleRoot", () => {
    it("includes head as merkleRoot", () => {
      const profile = computeProfile([], config, "abc123");
      expect(profile.merkleRoot).toBe("abc123");
    });

    it("is null when no head", () => {
      const profile = computeProfile([], config, null);
      expect(profile.merkleRoot).toBeNull();
    });
  });

  describe("determinism", () => {
    it("produces identical output for identical input (except generatedAt)", () => {
      const entries: DecisionMeta[] = [
        makeMeta({ context: "auth", source: "claude-code" }),
        makeMeta({ context: "billing", source: "git-commit" }),
      ];
      const p1 = computeProfile(entries, config, "head1");
      const p2 = computeProfile(entries, config, "head1");
      const { generatedAt: _a, ...rest1 } = p1;
      const { generatedAt: _b, ...rest2 } = p2;
      expect(rest1).toEqual(rest2);
    });
  });
});
