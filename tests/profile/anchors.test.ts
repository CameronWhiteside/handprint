import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { enrichAnchors, parseDuration, type AnchorContext } from "../../src/profile/anchors.js";

describe("parseDuration", () => {
  it("parses PT30M to 30 minutes in ms", () => {
    expect(parseDuration("PT30M")).toBe(30 * 60 * 1000);
  });

  it("parses PT1H to 1 hour in ms", () => {
    expect(parseDuration("PT1H")).toBe(60 * 60 * 1000);
  });

  it("parses PT60M to 60 minutes in ms", () => {
    expect(parseDuration("PT60M")).toBe(60 * 60 * 1000);
  });

  it("parses PT1H30M to 90 minutes in ms", () => {
    expect(parseDuration("PT1H30M")).toBe(90 * 60 * 1000);
  });

  it("parses PT45S to 45 seconds in ms", () => {
    expect(parseDuration("PT45S")).toBe(45 * 1000);
  });

  it("defaults to 30 minutes for invalid input", () => {
    expect(parseDuration("garbage")).toBe(30 * 60 * 1000);
  });
});

describe("enrichAnchors", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "handprint-anchors-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  const defaultConfig = {
    commitWindowBefore: "PT30M",
    commitWindowAfter: "PT60M",
    linkPRs: false,
    linkRepo: true,
  };

  it("returns empty for non-git directory", () => {
    const ctx: AnchorContext = {
      cwd: tmpDir,
      timestamp: new Date().toISOString(),
    };
    const anchors = enrichAnchors(ctx, defaultConfig);
    expect(anchors).toEqual([]);
  });

  it("returns repo anchor when git remote exists", () => {
    execSync("git init", { cwd: tmpDir });
    execSync("git remote add origin https://github.com/test/repo.git", { cwd: tmpDir });

    const ctx: AnchorContext = {
      cwd: tmpDir,
      timestamp: new Date().toISOString(),
    };
    const anchors = enrichAnchors(ctx, defaultConfig);
    const repoAnchor = anchors.find((a) => a.label.startsWith("repo:"));
    expect(repoAnchor).toBeDefined();
    expect(repoAnchor!.label).toBe("repo:https://github.com/test/repo.git");
    expect(repoAnchor!.verified).toBe(true);
  });

  it("skips repo anchor when linkRepo is false", () => {
    execSync("git init", { cwd: tmpDir });
    execSync("git remote add origin https://github.com/test/repo.git", { cwd: tmpDir });

    const ctx: AnchorContext = {
      cwd: tmpDir,
      timestamp: new Date().toISOString(),
    };
    const anchors = enrichAnchors(ctx, { ...defaultConfig, linkRepo: false });
    const repoAnchor = anchors.find((a) => a.label.startsWith("repo:"));
    expect(repoAnchor).toBeUndefined();
  });

  it("returns branch anchor when gitBranch provided", () => {
    execSync("git init", { cwd: tmpDir });

    const ctx: AnchorContext = {
      cwd: tmpDir,
      timestamp: new Date().toISOString(),
      gitBranch: "feature/my-branch",
    };
    const anchors = enrichAnchors(ctx, { ...defaultConfig, linkRepo: false });
    const branchAnchor = anchors.find((a) => a.label.startsWith("branch:"));
    expect(branchAnchor).toBeDefined();
    expect(branchAnchor!.label).toBe("branch:feature/my-branch");
    expect(branchAnchor!.verified).toBe(true);
  });

  it("returns git commit anchors for nearby commits", () => {
    execSync("git init", { cwd: tmpDir });
    execSync("git config user.email test@test.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    // Create a commit now
    execSync("git commit --allow-empty -m 'test commit'", { cwd: tmpDir });
    const commitHash = execSync("git log -1 --format=%H", { cwd: tmpDir, encoding: "utf-8" }).trim();

    const ctx: AnchorContext = {
      cwd: tmpDir,
      timestamp: new Date().toISOString(),
    };
    const anchors = enrichAnchors(ctx, { ...defaultConfig, linkRepo: false });
    const gitAnchors = anchors.filter((a) => a.label.startsWith("git:"));
    expect(gitAnchors.length).toBeGreaterThanOrEqual(1);
    expect(gitAnchors[0].label).toBe(`git:${commitHash.slice(0, 7)}`);
    expect(gitAnchors[0].verified).toBe(true);
  });

  it("does not return commits outside the time window", () => {
    execSync("git init", { cwd: tmpDir });
    execSync("git config user.email test@test.com", { cwd: tmpDir });
    execSync("git config user.name Test", { cwd: tmpDir });
    execSync("git commit --allow-empty -m 'test commit'", { cwd: tmpDir });

    // Use a timestamp far in the past so the commit is outside the window
    const ctx: AnchorContext = {
      cwd: tmpDir,
      timestamp: "2020-01-01T00:00:00.000Z",
    };
    const anchors = enrichAnchors(ctx, { ...defaultConfig, linkRepo: false });
    const gitAnchors = anchors.filter((a) => a.label.startsWith("git:"));
    expect(gitAnchors).toEqual([]);
  });
});
