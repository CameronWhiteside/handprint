import type { HandprintProfile, HandprintConfig, SocialProfile, SocialLink } from "./types.js";
import type { DecisionMeta } from "../model/meta.js";

const MONTH_NAMES = [
  "jan", "feb", "mar", "apr", "may", "jun",
  "jul", "aug", "sep", "oct", "nov", "dec",
];

function metaDate(e: DecisionMeta): Date | null {
  if (!e.ts) return null;
  const d = new Date(e.ts);
  return isNaN(d.getTime()) ? null : d;
}

export function computeProfile(
  entries: DecisionMeta[],
  config: HandprintConfig,
  head: string | null,
): HandprintProfile {
  const sorted = [...entries].sort((a, b) => {
    const ta = a.ts ?? "";
    const tb = b.ts ?? "";
    return ta < tb ? -1 : ta > tb ? 1 : 0;
  });

  const typeCounts = computeTypeCounts(sorted);
  const subtypeCounts = computeSubtypeCounts(sorted);
  const calibration = computeCalibration(sorted, config);
  const domains = computeDomains(sorted, config);
  const tools = computeTools(sorted);
  const heatmap = computeHeatmap(sorted, config);
  const streak = computeStreak(sorted);
  const featured = computeFeatured(sorted, config);
  const timeline = computeTimeline(sorted);
  const repos = computeRepos(sorted);

  const firstHandprint = sorted.length > 0
    ? (sorted[0].ts ?? sorted[0].seal)
    : "";

  const social = filterSocial(config.social);

  return {
    version: config.version,
    generatedAt: new Date().toISOString(),
    handle: config.identity.handle,
    name: config.identity.name,
    social,
    typeCounts,
    subtypeCounts,
    total: sorted.length,
    calibration,
    domains,
    tools,
    heatmap,
    streak,
    firstHandprint,
    featured,
    timeline,
    repos,
    merkleRoot: head,
  };
}

function computeTypeCounts(
  entries: DecisionMeta[],
): HandprintProfile["typeCounts"] {
  const counts: HandprintProfile["typeCounts"] = { vision: 0, choice: 0, method: 0 };
  for (const e of entries) {
    if (e.type in counts) counts[e.type as keyof typeof counts]++;
  }
  return counts;
}

function computeSubtypeCounts(entries: DecisionMeta[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.subtype) counts[e.subtype] = (counts[e.subtype] ?? 0) + 1;
  }
  return counts;
}

function computeCalibration(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["calibration"] {
  const resolved = entries.filter((e) => e.status === "resolved");
  const open = entries.filter((e) => e.status === "open");

  const breakdown = { validated: 0, partial: 0, revised: 0, invalidated: 0 };

  for (const entry of resolved) {
    const lastRes = entry.resolutions[entry.resolutions.length - 1];
    if (lastRes) {
      const status = lastRes.status as keyof typeof breakdown;
      if (status in breakdown) breakdown[status]++;
    }
  }

  const weights = config.protocol.calibration.weights;
  const totalResolved = resolved.length;
  const minResolved = config.protocol.calibration.minResolved;

  let score: number | null = null;
  if (totalResolved >= minResolved) {
    const weightedSum =
      breakdown.validated * weights.validated +
      breakdown.partial * weights.partial +
      breakdown.revised * weights.revised +
      breakdown.invalidated * weights.invalidated;
    score = weightedSum / totalResolved;
  }

  const formula =
    `(${breakdown.validated}×${weights.validated} validated` +
    ` + ${breakdown.partial}×${weights.partial} partial` +
    ` + ${breakdown.revised}×${weights.revised} revised` +
    ` + ${breakdown.invalidated}×${weights.invalidated} invalidated)` +
    ` / ${totalResolved} resolved`;

  return { score, resolved: totalResolved, open: open.length, breakdown, formula };
}

function computeDomains(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["domains"] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const label = e.project ?? e.context;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  const total = entries.length;
  const threshold = config.protocol.domains.strongThreshold;

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      strong: total > 0 ? count / total >= threshold : false,
    }));
}

function computeTools(entries: DecisionMeta[]): HandprintProfile["tools"] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.source ?? "unknown", (counts.get(e.source ?? "unknown") ?? 0) + 1);
  }
  const total = entries.length;
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, percentage: total > 0 ? (count / total) * 100 : 0 }));
}

function computeHeatmap(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["heatmap"] {
  const weeks = config.protocol.heatmap.weeks;
  const levels = config.protocol.heatmap.levels;

  const now = new Date();
  const endDate = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startDate = new Date(endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  const dayCounts = new Map<string, number>();
  for (const e of entries) {
    const d = metaDate(e);
    if (!d || d < startDate || d > endDate) continue;
    const key = d.toISOString().slice(0, 10);
    dayCounts.set(key, (dayCounts.get(key) ?? 0) + 1);
  }

  const maxCount = Math.max(1, ...dayCounts.values());
  const result: HandprintProfile["heatmap"] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const count = dayCounts.get(dateStr) ?? 0;
    const level = count === 0 ? 0 : Math.min(levels - 1, Math.ceil((count / maxCount) * (levels - 1)));
    result.push({ date: dateStr, count, level });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function computeStreak(entries: DecisionMeta[]): HandprintProfile["streak"] {
  const days = new Set<string>();
  for (const e of entries) {
    const d = metaDate(e);
    if (d) days.add(d.toISOString().slice(0, 10));
  }

  if (days.size === 0) return { current: 0, longest: 0 };

  const sorted = [...days].sort();
  let longest = 1;
  let current = 1;
  let streakLen = 1;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const lastDay = sorted[sorted.length - 1];
  const isActive = lastDay === today || lastDay === yesterday;

  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]).getTime();
    const curr = new Date(sorted[i]).getTime();
    if (curr - prev === 86400000) {
      streakLen++;
      longest = Math.max(longest, streakLen);
    } else {
      streakLen = 1;
    }
  }

  longest = Math.max(longest, streakLen);
  current = isActive ? streakLen : 0;

  return { current, longest };
}

function computeFeatured(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["featured"] {
  if (entries.length === 0) return null;
  const strategy = config.protocol.featured.strategy;

  if (strategy === "most-anchors") {
    const sorted = [...entries].sort((a, b) => {
      const anchorDiff = b.anchors.length - a.anchors.length;
      if (anchorDiff !== 0) return anchorDiff;
      return b.intent.length - a.intent.length;
    });
    return { hash: sorted[0].seal, strategy };
  }

  return { hash: entries[0].seal, strategy };
}

function computeTimeline(entries: DecisionMeta[]): HandprintProfile["timeline"] {
  if (entries.length === 0) return [];

  const months = new Map<string, HandprintProfile["timeline"][0]["entries"]>();

  for (const e of entries) {
    const d = metaDate(e);
    const monthKey = d
      ? `${d.getUTCFullYear()}-${MONTH_NAMES[d.getUTCMonth()]}`
      : "unknown";

    if (!months.has(monthKey)) months.set(monthKey, []);
    months.get(monthKey)!.push({
      seal: e.seal,
      type: e.type,
      subtype: e.subtype,
      context: e.context,
      intent: e.intent,
      risk: e.risk,
      status: e.status,
      horizon: e.horizon,
      anchors: e.anchors,
      resolutions: e.resolutions,
    });
  }

  return [...months.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([month, entries]) => ({ month, entries }));
}

function computeRepos(entries: DecisionMeta[]): HandprintProfile["repos"] {
  const repoCounts = new Map<string, number>();

  for (const e of entries) {
    if (e.repo) {
      repoCounts.set(e.repo, (repoCounts.get(e.repo) ?? 0) + 1);
    }
    for (const a of e.anchors) {
      if (a.label.startsWith("repo:")) {
        const url = a.label.slice(5);
        repoCounts.set(url, (repoCounts.get(url) ?? 0) + 1);
      }
    }
  }

  return [...repoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url, handprintCount]) => ({ url, handprintCount }));
}

function filterSocial(social?: SocialProfile): SocialProfile | undefined {
  if (!social) return undefined;
  const out: SocialProfile = {};
  for (const [key, link] of Object.entries(social) as [keyof SocialProfile, SocialLink | undefined][]) {
    if (!link) continue;
    if (link.visibility === "private") continue;
    out[key] = { ...link };
  }
  return Object.keys(out).length > 0 ? out : undefined;
}
