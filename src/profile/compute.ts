import type { HandprintProfile, HandprintConfig } from "./types.js";
import type { DecisionMeta } from "../model/meta.js";

const MONTH_NAMES = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

export function computeProfile(
  entries: DecisionMeta[],
  config: HandprintConfig,
  head: string | null,
): HandprintProfile {
  const typeCounts = computeTypeCounts(entries);
  const subtypeCounts = computeSubtypeCounts(entries);
  const calibration = computeCalibration(entries, config);
  const domains = computeDomains(entries, config);
  const tools = computeTools(entries);
  const heatmap = computeHeatmap(entries, config);
  const streak = computeStreak(entries);
  const featured = computeFeatured(entries, config);
  const timeline = computeTimeline(entries);
  const repos = computeRepos(entries);

  // For firstHandprint, we don't have timestamps on meta directly,
  // so use the seal hash of the first entry as a proxy
  const firstHandprint = entries.length > 0 ? entries[0].seal : "";

  return {
    version: config.version,
    generatedAt: new Date().toISOString(),
    handle: config.identity.handle,
    name: config.identity.name,
    typeCounts,
    subtypeCounts,
    total: entries.length,
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
  const counts: HandprintProfile["typeCounts"] = {
    vision: 0,
    choice: 0,
    method: 0,
  };
  for (const e of entries) {
    if (e.type in counts) {
      counts[e.type as keyof typeof counts]++;
    }
  }
  return counts;
}

function computeSubtypeCounts(entries: DecisionMeta[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const e of entries) {
    if (e.subtype) {
      counts[e.subtype] = (counts[e.subtype] ?? 0) + 1;
    }
  }
  return counts;
}

function computeCalibration(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["calibration"] {
  const resolved = entries.filter((e) => e.status === "resolved");
  const open = entries.filter((e) => e.status === "open");

  const breakdown = {
    validated: 0,
    partial: 0,
    revised: 0,
    invalidated: 0,
  };

  for (const entry of resolved) {
    const lastRes = entry.resolutions[entry.resolutions.length - 1];
    if (lastRes) {
      const status = lastRes.status as keyof typeof breakdown;
      if (status in breakdown) {
        breakdown[status]++;
      }
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
    `(${breakdown.validated} * ${weights.validated} validated` +
    ` + ${breakdown.partial} * ${weights.partial} partial` +
    ` + ${breakdown.revised} * ${weights.revised} revised` +
    ` + ${breakdown.invalidated} * ${weights.invalidated} invalidated)` +
    ` / ${totalResolved} resolved`;

  return {
    score,
    resolved: totalResolved,
    open: open.length,
    breakdown,
    formula,
  };
}

function computeDomains(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["domains"] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    counts.set(e.context, (counts.get(e.context) ?? 0) + 1);
  }

  const total = entries.length;
  const threshold = config.protocol.domains.strongThreshold;

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => {
      const percentage = total > 0 ? (count / total) * 100 : 0;
      return {
        name,
        count,
        percentage,
        strong: total > 0 ? count / total >= threshold : false,
      };
    });
}

function computeTools(entries: DecisionMeta[]): HandprintProfile["tools"] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    const source = e.source ?? "unknown";
    counts.set(source, (counts.get(source) ?? 0) + 1);
  }

  const total = entries.length;

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }));
}

function computeHeatmap(
  entries: DecisionMeta[],
  config: HandprintConfig,
): HandprintProfile["heatmap"] {
  const weeks = config.protocol.heatmap.weeks;
  const levels = config.protocol.heatmap.levels;

  const now = new Date();
  const endDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startDate = new Date(
    endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000,
  );

  // Meta entries don't have a direct timestamp, but resolutions do
  // Use the seal hash as a proxy - no date available from meta alone
  // For now, return empty heatmap since meta doesn't carry timestamps directly
  const result: HandprintProfile["heatmap"] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    result.push({ date: dateStr, count: 0, level: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return result;
}

function computeStreak(
  entries: DecisionMeta[],
): HandprintProfile["streak"] {
  // Without direct timestamps on meta, streak is 0
  return { current: 0, longest: 0 };
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

function computeTimeline(
  entries: DecisionMeta[],
): HandprintProfile["timeline"] {
  // Group by seal hash since we don't have timestamps on meta
  // For now, return a flat list under a single "all" month
  if (entries.length === 0) return [];

  const timelineEntries = entries.map((e) => ({
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
  }));

  return [{ month: "all", entries: timelineEntries }];
}

function computeRepos(entries: DecisionMeta[]): HandprintProfile["repos"] {
  const repoCounts = new Map<string, number>();

  for (const e of entries) {
    const repoAnchors = e.anchors.filter((a) => a.label.startsWith("repo:"));
    const uniqueRepos = new Set(repoAnchors.map((a) => a.label.slice(5)));
    for (const url of uniqueRepos) {
      repoCounts.set(url, (repoCounts.get(url) ?? 0) + 1);
    }
  }

  return [...repoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url, handprintCount]) => ({ url, handprintCount }));
}
