import { describe, it, expect } from "vitest";
import {
  parseGitLog,
  classifyCommit,
} from "../../src/scanner/git.js";
import type { GitCommit } from "../../src/scanner/git.js";

describe("git scanner", () => {
  describe("parseGitLog", () => {
    it("parses git log --format output into structured commits", () => {
      const raw = [
        "abc1234|2026-06-01T10:00:00Z|Cameron Whiteside|feat: edge JWT middleware",
        "def5678|2026-06-01T09:00:00Z|Cameron Whiteside|fix: remove vendor auth from billing",
      ].join("\n");
      const commits = parseGitLog(raw);
      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe("abc1234");
      expect(commits[0].message).toBe("feat: edge JWT middleware");
    });

    it("handles empty input", () => {
      expect(parseGitLog("")).toEqual([]);
      expect(parseGitLog("\n")).toEqual([]);
    });

    it("handles messages containing pipe characters", () => {
      const raw =
        "abc1234|2026-06-01T10:00:00Z|Test User|feat: use A | B pattern for routing";
      const commits = parseGitLog(raw);
      expect(commits).toHaveLength(1);
      expect(commits[0].message).toBe(
        "feat: use A | B pattern for routing",
      );
    });
  });

  describe("classifyCommit", () => {
    it("detects choice signals (override)", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "feat: use edge JWT instead of centralized gateway",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("choice");
    });

    it("detects choice signals (rejection)", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message:
          "chore: remove recommendations engine — not ready for v2",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("choice");
    });

    it("detects choice signals (constraint)", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "fix: enforce no third-party auth in billing path",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("choice");
    });

    it("returns null for routine commits", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "chore: update dependencies",
      };
      expect(classifyCommit(commit)).toBeNull();
    });

    it("returns null for merge commits", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "Merge branch 'main' into feature",
      };
      expect(classifyCommit(commit)).toBeNull();
    });

    it("collects matching signals", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "feat: switching to edge JWT instead of gateway",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.signals.length).toBeGreaterThanOrEqual(1);
    });
  });
});
