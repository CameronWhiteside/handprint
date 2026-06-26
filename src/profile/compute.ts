import type {
  HandprintProfile,
  HandprintConfig,
} from "./types.js";
import type { HandprintEntry } from "../commands/log.js";
import type { Resolution } from "../model/resolution.js";
import { HandprintType } from "../model/handprint.js";
import { ResolutionStatus } from "../model/resolution.js";

interface ExportedEntry extends HandprintEntry {
  resolutions: Resolution[];
}

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
  entries: ExportedEntry[],
  config: HandprintConfig,
  head: string | null,
): HandprintProfile {
  const typeCounts = computeTypeCounts(entries);
  const calibration = computeCalibration(entries, config);
  const domains = computeDomains(entries, config);
  const tools = computeTools(entries);
  const heatmap = computeHeatmap(entries, config);
  const streak = computeStreak(entries);
  const featured = computeFeatured(entries, config);
  const timeline = computeTimeline(entries);
  const repos = computeRepos(entries);

  const sorted = [...entries].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );
  const firstHandprint = sorted.length > 0 ? sorted[0].timestamp : "";

  return {
    version: config.version,
    generatedAt: new Date().toISOString(),
    handle: config.identity.handle,
    name: config.identity.name,
    typeCounts,
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

function computeTypeCounts(entries: ExportedEntry[]): HandprintProfile["typeCounts"] {
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

function computeCalibration(
  entries: ExportedEntry[],
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
    // Use the last resolution's status
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
  entries: ExportedEntry[],
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

function computeTools(entries: ExportedEntry[]): HandprintProfile["tools"] {
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
  entries: ExportedEntry[],
  config: HandprintConfig,
): HandprintProfile["heatmap"] {
  const weeks = config.protocol.heatmap.weeks;
  const levels = config.protocol.heatmap.levels;

  // Find the end date: latest entry date or today
  const now = new Date();
  const endDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const startDate = new Date(endDate.getTime() - weeks * 7 * 24 * 60 * 60 * 1000);

  // Count handprints per day
  const dayCounts = new Map<string, number>();
  for (const e of entries) {
    const day = e.timestamp.slice(0, 10); // YYYY-MM-DD
    dayCounts.set(day, (dayCounts.get(day) ?? 0) + 1);
  }

  // Build heatmap entries for each day in the window
  const result: HandprintProfile["heatmap"] = [];
  const cursor = new Date(startDate);
  while (cursor <= endDate) {
    const dateStr = cursor.toISOString().slice(0, 10);
    const count = dayCounts.get(dateStr) ?? 0;
    result.push({ date: dateStr, count, level: 0 });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  // Compute intensity levels
  const maxCount = Math.max(...result.map((r) => r.count), 0);
  if (maxCount > 0) {
    for (const entry of result) {
      if (entry.count === 0) {
        entry.level = 0;
      } else {
        // Scale: level = ceil(count / maxCount * (levels - 1))
        entry.level = Math.ceil((entry.count / maxCount) * (levels - 1));
      }
    }
  }

  return result;
}

function computeStreak(entries: ExportedEntry[]): HandprintProfile["streak"] {
  if (entries.length === 0) return { current: 0, longest: 0 };

  // Get unique dates with at least one handprint
  const dates = new Set<string>();
  for (const e of entries) {
    dates.add(e.timestamp.slice(0, 10));
  }

  // Sort dates
  const sortedDates = [...dates].sort();
  if (sortedDates.length === 0) return { current: 0, longest: 0 };

  // Build streaks
  let longest = 1;
  let currentRun = 1;

  for (let i = 1; i < sortedDates.length; i++) {
    const prev = new Date(sortedDates[i - 1]);
    const curr = new Date(sortedDates[i]);
    const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);

    if (diffDays === 1) {
      currentRun++;
    } else {
      if (currentRun > longest) longest = currentRun;
      currentRun = 1;
    }
  }
  if (currentRun > longest) longest = currentRun;

  // Current streak: count backward from the most recent date
  let current = 1;
  for (let i = sortedDates.length - 1; i > 0; i--) {
    const curr = new Date(sortedDates[i]);
    const prev = new Date(sortedDates[i - 1]);
    const diffDays = (curr.getTime() - prev.getTime()) / (24 * 60 * 60 * 1000);

    if (diffDays === 1) {
      current++;
    } else {
      break;
    }
  }

  return { current, longest };
}

function computeFeatured(
  entries: ExportedEntry[],
  config: HandprintConfig,
): HandprintProfile["featured"] {
  if (entries.length === 0) return null;

  const strategy = config.protocol.featured.strategy;

  if (strategy === "most-anchors") {
    const sorted = [...entries].sort((a, b) => {
      // Primary: most anchors
      const anchorDiff = b.anchors.length - a.anchors.length;
      if (anchorDiff !== 0) return anchorDiff;
      // Tiebreaker: longest intent
      return b.intent.length - a.intent.length;
    });
    return { hash: sorted[0].hash, strategy };
  }

  // Fallback: first entry
  return { hash: entries[0].hash, strategy };
}

function computeTimeline(
  entries: ExportedEntry[],
): HandprintProfile["timeline"] {
  // Group by month
  const months = new Map<
    string,
    Array<HandprintProfile["timeline"][number]["entries"][number]>
  >();

  for (const e of entries) {
    const d = new Date(e.timestamp);
    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`;
    const monthLabel = `${MONTH_NAMES[d.getUTCMonth()]} · ${d.getUTCFullYear()}`;

    if (!months.has(monthKey)) {
      months.set(monthKey, []);
    }

    const statusLabel = formatStatusLabel(e);

    months.get(monthKey)!.push({
      hash: e.hash,
      day: String(d.getUTCDate()).padStart(2, "0"),
      time: `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`,
      type: e.type,
      context: e.context,
      intent: e.intent,
      risk: e.risk,
      status: e.status,
      statusLabel,
      horizon: e.horizon,
      anchors: e.anchors,
      resolutions: e.resolutions.map((r) => ({
        status: r.status,
        body: r.body,
        timestamp: r.timestamp,
      })),
    });
  }

  // Sort months newest first
  return [...months.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([key, monthEntries]) => {
      const [year, monthIdx] = key.split("-");
      const label = `${MONTH_NAMES[parseInt(monthIdx)]} · ${year}`;
      return { month: label, entries: monthEntries };
    });
}

function formatStatusLabel(e: ExportedEntry): string {
  if (e.status === "open") return "OPEN";

  const lastRes = e.resolutions[e.resolutions.length - 1];
  if (!lastRes) return "RESOLVED";

  switch (lastRes.status) {
    case ResolutionStatus.Validated:
      return "VALIDATED";
    case ResolutionStatus.Partial:
      return e.confidence !== null
        ? `PARTIAL · ${e.confidence}`
        : "PARTIAL";
    case ResolutionStatus.Revised:
      return "REVISED";
    case ResolutionStatus.Invalidated:
      return "INVALIDATED";
    default:
      return "RESOLVED";
  }
}

function computeRepos(entries: ExportedEntry[]): HandprintProfile["repos"] {
  const repoCounts = new Map<string, number>();

  for (const e of entries) {
    const repoAnchors = e.anchors.filter((a) => a.label.startsWith("repo:"));
    // Get unique repo URLs for this entry
    const uniqueRepos = new Set(repoAnchors.map((a) => a.label.slice(5)));
    for (const url of uniqueRepos) {
      repoCounts.set(url, (repoCounts.get(url) ?? 0) + 1);
    }
  }

  return [...repoCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([url, handprintCount]) => ({ url, handprintCount }));
}
