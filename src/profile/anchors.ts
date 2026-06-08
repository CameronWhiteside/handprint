import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Anchor } from "../model/handprint.js";

export interface AnchorContext {
  cwd: string;
  timestamp: string;
  gitBranch?: string;
}

export function enrichAnchors(
  ctx: AnchorContext,
  config: {
    commitWindowBefore: string;
    commitWindowAfter: string;
    linkPRs: boolean;
    linkRepo: boolean;
  },
): Anchor[] {
  const anchors: Anchor[] = [];

  if (!existsSync(join(ctx.cwd, ".git"))) return anchors;

  // Repo URL
  if (config.linkRepo) {
    try {
      const url = execSync("git remote get-url origin", {
        cwd: ctx.cwd,
        encoding: "utf-8",
      }).trim();
      if (url) anchors.push({ label: `repo:${url}`, verified: true });
    } catch {
      /* no remote */
    }
  }

  // Branch
  if (ctx.gitBranch) {
    anchors.push({ label: `branch:${ctx.gitBranch}`, verified: true });
  }

  // Nearby commits
  try {
    const beforeMs = parseDuration(config.commitWindowBefore);
    const afterMs = parseDuration(config.commitWindowAfter);
    const ts = new Date(ctx.timestamp);
    const after = new Date(ts.getTime() - beforeMs).toISOString();
    const before = new Date(ts.getTime() + afterMs).toISOString();

    const log = execSync(
      `git log --format="%H|%s" --after="${after}" --before="${before}"`,
      { cwd: ctx.cwd, encoding: "utf-8" },
    ).trim();

    if (log) {
      for (const line of log.split("\n").filter(Boolean)) {
        const [hash] = line.split("|");
        if (hash) anchors.push({ label: `git:${hash.slice(0, 7)}`, verified: true });
      }
    }
  } catch {
    /* git log failed */
  }

  // PR links
  if (config.linkPRs && ctx.gitBranch) {
    try {
      const prJson = execSync(
        `gh pr list --head "${ctx.gitBranch}" --json url --limit 1`,
        { cwd: ctx.cwd, encoding: "utf-8" },
      ).trim();
      const prs = JSON.parse(prJson);
      if (Array.isArray(prs) && prs.length > 0 && prs[0].url) {
        anchors.push({ label: `pr:${prs[0].url}`, verified: true });
      }
    } catch {
      /* gh not available or no PR */
    }
  }

  return anchors;
}

export function parseDuration(iso: string): number {
  // Parse simple ISO 8601 durations: PT30M, PT1H, PT60M, PT1H30M
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 30 * 60 * 1000; // default 30min
  const hours = parseInt(match[1] || "0");
  const minutes = parseInt(match[2] || "0");
  const seconds = parseInt(match[3] || "0");
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}
