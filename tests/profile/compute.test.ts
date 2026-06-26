import { describe, it, expect } from "vitest";
import { computeProfile } from "../../src/profile/compute.js";
import { DEFAULT_PROTOCOL, type HandprintConfig } from "../../src/profile/types.js";
import { HandprintType } from "../../src/model/handprint.js";
import { ResolutionStatus, type Resolution } from "../../src/model/resolution.js";
import type { HandprintEntry } from "../../src/commands/log.js";

interface ExportedEntry extends HandprintEntry {
  resolutions: Resolution[];
}

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

function makeEntry(
  overrides: Partial<ExportedEntry> & { hash: string },
): ExportedEntry {
  return {
    type: HandprintType.Vision,
    intent: "test intent",
    risk: "test risk",
    context: "test-domain",
    timestamp: "2026-06-01T10:00:00.000Z",
    author: "Test <test@test.com>",
    horizon: null,
    confidence: 0.9,
    source: "claude-code",
    anchors: [],
    status: "open",
    parent: null,
    resolutions: [],
    ...overrides,
  };
}

const config = makeConfig();

describe("computeProfile", () => {
  describe("typeCounts", () => {
    it("counts entries by type", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "a1", type: HandprintType.Vision }),
        makeEntry({ hash: "a2", type: HandprintType.Vision }),
        makeEntry({ hash: "a3", type: HandprintType.Choice }),
        makeEntry({ hash: "a4", type: HandprintType.Choice }),
        makeEntry({ hash: "a5", type: HandprintType.Method }),
        makeEntry({ hash: "a6", type: HandprintType.Method }),
        makeEntry({ hash: "a7", type: HandprintType.Method }),
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

  describe("calibration", () => {
    it("computes calibration score with default weights", () => {
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "r1",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "r1",
              status: ResolutionStatus.Validated,
              body: "correct",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
        makeEntry({
          hash: "r2",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "r2",
              status: ResolutionStatus.Partial,
              body: "partially",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
        makeEntry({
          hash: "r3",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "r3",
              status: ResolutionStatus.Revised,
              body: "revised",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
        makeEntry({
          hash: "r4",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "r4",
              status: ResolutionStatus.Invalidated,
              body: "wrong",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
        makeEntry({
          hash: "r5",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "r5",
              status: ResolutionStatus.Validated,
              body: "correct",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
        // One open entry (not counted in calibration)
        makeEntry({ hash: "o1", status: "open" }),
      ];

      const profile = computeProfile(entries, config, null);
      // Weights: validated=1.0, partial=0.5, revised=0.25, invalidated=0.0
      // 2*1.0 + 1*0.5 + 1*0.25 + 1*0.0 = 2.75
      // 2.75 / 5 = 0.55
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
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "r1",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "r1",
              status: ResolutionStatus.Validated,
              body: "ok",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.calibration.score).toBeNull();
      expect(profile.calibration.resolved).toBe(1);
    });

    it("includes a formula string", () => {
      const entries: ExportedEntry[] = Array.from({ length: 5 }, (_, i) =>
        makeEntry({
          hash: `f${i}`,
          status: "resolved",
          resolutions: [
            {
              handprintHash: `f${i}`,
              status: ResolutionStatus.Validated,
              body: "ok",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
      );
      const profile = computeProfile(entries, config, null);
      expect(profile.calibration.formula).toContain("validated");
      expect(typeof profile.calibration.formula).toBe("string");
    });
  });

  describe("domains", () => {
    it("groups by context, sorted descending by count", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "d1", context: "auth" }),
        makeEntry({ hash: "d2", context: "auth" }),
        makeEntry({ hash: "d3", context: "auth" }),
        makeEntry({ hash: "d4", context: "billing" }),
        makeEntry({ hash: "d5", context: "billing" }),
        makeEntry({ hash: "d6", context: "onboarding" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.domains[0].name).toBe("auth");
      expect(profile.domains[0].count).toBe(3);
      expect(profile.domains[0].percentage).toBeCloseTo(50);
      expect(profile.domains[1].name).toBe("billing");
      expect(profile.domains[1].count).toBe(2);
    });

    it("marks domains at or above strongThreshold as strong", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "d1", context: "auth" }),
        makeEntry({ hash: "d2", context: "auth" }),
        makeEntry({ hash: "d3", context: "billing" }),
        makeEntry({ hash: "d4", context: "billing" }),
        makeEntry({ hash: "d5", context: "billing" }),
        makeEntry({ hash: "d6", context: "billing" }),
        makeEntry({ hash: "d7", context: "billing" }),
        makeEntry({ hash: "d8", context: "billing" }),
        makeEntry({ hash: "d9", context: "billing" }),
        makeEntry({ hash: "d10", context: "billing" }),
      ];
      // auth = 2/10 = 20%, billing = 8/10 = 80%
      // strongThreshold = 0.10 (10%), both should be strong
      const profile = computeProfile(entries, config, null);
      expect(profile.domains.every((d) => d.strong)).toBe(true);
    });

    it("marks low-percentage domains as not strong", () => {
      // Make 100 entries in domain "main", 1 in "tiny"
      const entries: ExportedEntry[] = [
        ...Array.from({ length: 100 }, (_, i) =>
          makeEntry({ hash: `m${i}`, context: "main" }),
        ),
        makeEntry({ hash: "t1", context: "tiny" }),
      ];
      const profile = computeProfile(entries, config, null);
      const tiny = profile.domains.find((d) => d.name === "tiny");
      expect(tiny).toBeDefined();
      // tiny = 1/101 ~ 0.99%, threshold is 10%
      expect(tiny!.strong).toBe(false);
    });
  });

  describe("tools", () => {
    it("groups by source field, sorted descending", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "t1", source: "claude-code" }),
        makeEntry({ hash: "t2", source: "claude-code" }),
        makeEntry({ hash: "t3", source: "git-commit" }),
        makeEntry({ hash: "t4", source: null }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.tools[0].name).toBe("claude-code");
      expect(profile.tools[0].count).toBe(2);
      expect(profile.tools[0].percentage).toBeCloseTo(50);
      expect(profile.tools.length).toBe(3);
    });
  });

  describe("heatmap", () => {
    it("generates entries for each day in the window", () => {
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "h1",
          timestamp: "2026-06-01T10:00:00.000Z",
        }),
        makeEntry({
          hash: "h2",
          timestamp: "2026-06-01T14:00:00.000Z",
        }),
        makeEntry({
          hash: "h3",
          timestamp: "2026-06-02T10:00:00.000Z",
        }),
      ];
      // Use a small heatmap window for testing
      const smallConfig = makeConfig({
        protocol: {
          ...DEFAULT_PROTOCOL,
          heatmap: { weeks: 1, levels: 5 },
        },
      });
      const profile = computeProfile(entries, smallConfig, null);
      // 1 week = 7 days + end day inclusive = 7*1 + 1 days
      expect(profile.heatmap.length).toBeGreaterThanOrEqual(7);
    });

    it("assigns correct intensity levels", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "h1", timestamp: "2026-06-01T10:00:00.000Z" }),
        makeEntry({ hash: "h2", timestamp: "2026-06-01T14:00:00.000Z" }),
        makeEntry({ hash: "h3", timestamp: "2026-06-01T18:00:00.000Z" }),
        makeEntry({ hash: "h4", timestamp: "2026-06-02T10:00:00.000Z" }),
      ];
      const smallConfig = makeConfig({
        protocol: {
          ...DEFAULT_PROTOCOL,
          heatmap: { weeks: 1, levels: 5 },
        },
      });
      const profile = computeProfile(entries, smallConfig, null);
      const june1 = profile.heatmap.find((h) => h.date === "2026-06-01");
      const june2 = profile.heatmap.find((h) => h.date === "2026-06-02");
      expect(june1).toBeDefined();
      expect(june1!.count).toBe(3);
      expect(june1!.level).toBe(4); // max count = 3, so 3/3 * (5-1) = 4
      expect(june2).toBeDefined();
      expect(june2!.count).toBe(1);
    });

    it("assigns level 0 to days with no handprints", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "h1", timestamp: "2026-06-01T10:00:00.000Z" }),
      ];
      const smallConfig = makeConfig({
        protocol: {
          ...DEFAULT_PROTOCOL,
          heatmap: { weeks: 1, levels: 5 },
        },
      });
      const profile = computeProfile(entries, smallConfig, null);
      const emptyDays = profile.heatmap.filter((h) => h.count === 0);
      expect(emptyDays.every((d) => d.level === 0)).toBe(true);
    });
  });

  describe("streak", () => {
    it("computes current and longest streak", () => {
      // 3 consecutive days with handprints
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "s1", timestamp: "2026-06-01T10:00:00.000Z" }),
        makeEntry({ hash: "s2", timestamp: "2026-06-02T10:00:00.000Z" }),
        makeEntry({ hash: "s3", timestamp: "2026-06-03T10:00:00.000Z" }),
      ];
      const profile = computeProfile(entries, config, null);
      // Current streak counts backward from the most recent handprint date
      expect(profile.streak.current).toBe(3);
      expect(profile.streak.longest).toBe(3);
    });

    it("handles gaps in streak", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "s1", timestamp: "2026-06-01T10:00:00.000Z" }),
        makeEntry({ hash: "s2", timestamp: "2026-06-02T10:00:00.000Z" }),
        // Gap on june 3
        makeEntry({ hash: "s3", timestamp: "2026-06-04T10:00:00.000Z" }),
        makeEntry({ hash: "s4", timestamp: "2026-06-05T10:00:00.000Z" }),
        makeEntry({ hash: "s5", timestamp: "2026-06-06T10:00:00.000Z" }),
      ];
      const profile = computeProfile(entries, config, null);
      // Current streak: june 4, 5, 6 = 3
      expect(profile.streak.current).toBe(3);
      // Longest: 3 (june 4-6), not 2 (june 1-2)
      expect(profile.streak.longest).toBe(3);
    });

    it("returns 0 for empty entries", () => {
      const profile = computeProfile([], config, null);
      expect(profile.streak.current).toBe(0);
      expect(profile.streak.longest).toBe(0);
    });
  });

  describe("featured", () => {
    it("selects handprint with most anchors", () => {
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "f1",
          anchors: [{ label: "repo:x", verified: true }],
          intent: "short",
        }),
        makeEntry({
          hash: "f2",
          anchors: [
            { label: "repo:x", verified: true },
            { label: "branch:main", verified: true },
            { label: "git:abc1234", verified: true },
          ],
          intent: "this one has the most anchors",
        }),
        makeEntry({
          hash: "f3",
          anchors: [
            { label: "repo:x", verified: true },
            { label: "branch:main", verified: true },
          ],
          intent: "medium anchors",
        }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.featured).not.toBeNull();
      expect(profile.featured!.hash).toBe("f2");
      expect(profile.featured!.strategy).toBe("most-anchors");
    });

    it("breaks ties with longest intent", () => {
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "f1",
          anchors: [{ label: "repo:x", verified: true }],
          intent: "short",
        }),
        makeEntry({
          hash: "f2",
          anchors: [{ label: "repo:x", verified: true }],
          intent: "this is a much longer intent that should win the tiebreaker",
        }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.featured!.hash).toBe("f2");
    });

    it("returns null for empty entries", () => {
      const profile = computeProfile([], config, null);
      expect(profile.featured).toBeNull();
    });
  });

  describe("timeline", () => {
    it("groups by month, sorted newest first", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "t1", timestamp: "2026-05-15T10:00:00.000Z" }),
        makeEntry({ hash: "t2", timestamp: "2026-06-01T10:00:00.000Z" }),
        makeEntry({ hash: "t3", timestamp: "2026-06-15T14:00:00.000Z" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.timeline.length).toBe(2);
      expect(profile.timeline[0].month).toMatch(/jun/i);
      expect(profile.timeline[0].entries.length).toBe(2);
      expect(profile.timeline[1].month).toMatch(/may/i);
      expect(profile.timeline[1].entries.length).toBe(1);
    });

    it("includes status labels", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "t1", status: "open" }),
        makeEntry({
          hash: "t2",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "t2",
              status: ResolutionStatus.Validated,
              body: "ok",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
        }),
        makeEntry({
          hash: "t3",
          status: "resolved",
          resolutions: [
            {
              handprintHash: "t3",
              status: ResolutionStatus.Partial,
              body: "partial",
              learnings: [],
              timestamp: "2026-06-02T00:00:00Z",
              author: "test",
            },
          ],
          confidence: 0.6,
        }),
      ];
      const profile = computeProfile(entries, config, null);
      const tl = profile.timeline[0].entries;
      const open = tl.find((e) => e.hash === "t1");
      const validated = tl.find((e) => e.hash === "t2");
      const partial = tl.find((e) => e.hash === "t3");

      expect(open!.statusLabel).toBe("OPEN");
      expect(validated!.statusLabel).toBe("VALIDATED");
      expect(partial!.statusLabel).toContain("PARTIAL");
    });

    it("includes entry fields: hash, day, time, type, context, intent, risk", () => {
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "t1",
          timestamp: "2026-06-01T14:30:00.000Z",
          type: HandprintType.Choice,
          context: "auth",
          intent: "use edge JWT",
          risk: "latency",
        }),
      ];
      const profile = computeProfile(entries, config, null);
      const entry = profile.timeline[0].entries[0];
      expect(entry.hash).toBe("t1");
      expect(entry.day).toBe("01");
      expect(entry.time).toBe("14:30");
      expect(entry.type).toBe("choice");
      expect(entry.context).toBe("auth");
      expect(entry.intent).toBe("use edge JWT");
      expect(entry.risk).toBe("latency");
    });
  });

  describe("repos", () => {
    it("extracts unique repo URLs from anchors", () => {
      const entries: ExportedEntry[] = [
        makeEntry({
          hash: "r1",
          anchors: [
            { label: "repo:https://github.com/test/a.git", verified: true },
            { label: "branch:main", verified: true },
          ],
        }),
        makeEntry({
          hash: "r2",
          anchors: [
            { label: "repo:https://github.com/test/a.git", verified: true },
          ],
        }),
        makeEntry({
          hash: "r3",
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
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "r1", anchors: [] }),
      ];
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

  describe("firstHandprint", () => {
    it("returns the earliest timestamp", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "e1", timestamp: "2026-06-15T10:00:00.000Z" }),
        makeEntry({ hash: "e2", timestamp: "2026-01-01T00:00:00.000Z" }),
        makeEntry({ hash: "e3", timestamp: "2026-03-15T10:00:00.000Z" }),
      ];
      const profile = computeProfile(entries, config, null);
      expect(profile.firstHandprint).toBe("2026-01-01T00:00:00.000Z");
    });

    it("returns empty string for no entries", () => {
      const profile = computeProfile([], config, null);
      expect(profile.firstHandprint).toBe("");
    });
  });

  describe("determinism", () => {
    it("produces identical output for identical input (except generatedAt)", () => {
      const entries: ExportedEntry[] = [
        makeEntry({ hash: "d1", context: "auth", source: "claude-code" }),
        makeEntry({ hash: "d2", context: "billing", source: "git-commit" }),
      ];
      const p1 = computeProfile(entries, config, "head1");
      const p2 = computeProfile(entries, config, "head1");
      // generatedAt will differ, so compare everything else
      const { generatedAt: _a, ...rest1 } = p1;
      const { generatedAt: _b, ...rest2 } = p2;
      expect(rest1).toEqual(rest2);
    });
  });
});
