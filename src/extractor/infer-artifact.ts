// Infer the work an handprint belongs to from what the conversation changed.
//
// The strongest signal is the file paths touched in each message's tool calls:
// a session launched from $HOME can still edit files in three different repos,
// and each handprint should attach to the repo it actually changed. So we
// resolve the touched paths to their git repos and attribute by the dominant
// repo. Only when a chunk touched no files do we fall back to the per-message
// `cwd` (where Claude was launched). Either way we resolve to a GitHub repo via
// its git remote, or a local `file:///<name>` identity — anything but "other".
import { execFileSync } from 'node:child_process';
import { basename, dirname, isAbsolute } from 'node:path';
import { homedir } from 'node:os';
import type { Artifact } from '@handprint/types';

/**
 * Normalize any git remote URL to a canonical `https://<host>/<org>/<repo>`,
 * dropping a trailing `.git`. Handles https, scp-style (`git@host:org/repo`),
 * and `ssh://` remotes. Returns null for anything unrecognizable.
 */
export function normalizeGitRemote(remote: string): string | null {
  let r = remote.trim();
  if (!r) return null;
  r = r.replace(/\.git$/, '');
  // scp-style: git@github.com:org/repo
  const scp = r.match(/^[\w.-]+@([\w.-]+):(.+)$/);
  if (scp) return `https://${scp[1]}/${scp[2]}`;
  // ssh://git@github.com/org/repo
  const ssh = r.match(/^ssh:\/\/(?:[\w.-]+@)?([\w.-]+)\/(.+)$/);
  if (ssh) return `https://${ssh[1]}/${ssh[2]}`;
  // http(s)://[user@]host/org/repo
  const http = r.match(/^https?:\/\/(?:[\w.-]+@)?([\w.-]+)\/(.+)$/);
  if (http) return `https://${http[1]}/${http[2]}`;
  return null;
}

function tryGit(cwd: string, args: string[]): string | null {
  try {
    return execFileSync('git', ['-C', cwd, ...args], {
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 3000,
    }).trim();
  } catch {
    return null;
  }
}

/** Resolve a single cwd to its work artifact, or null when there is no entity. */
function computeArtifact(cwd: string): Artifact | null {
  if (!cwd || cwd === homedir()) return null;
  const remote = tryGit(cwd, ['remote', 'get-url', 'origin']);
  if (remote) {
    const uri = normalizeGitRemote(remote);
    if (uri) return { type: 'git-repo', uri };
  }
  // A git repo with no remote: identify by its top-level dir name (never the
  // full local path — that would leak the user's filesystem layout).
  const root = tryGit(cwd, ['rev-parse', '--show-toplevel']);
  if (root) return { type: 'git-repo', uri: `file:///${basename(root)}` };
  // Not a git dir at all, but a real working dir: bucket by its basename.
  return { type: 'file', uri: `file:///${basename(cwd)}` };
}

export interface InferEntry {
  cwd: string;
  /** Absolute file paths touched in this message's tool calls. */
  paths?: string[];
}
export type ArtifactResolver = (entries: ReadonlyArray<InferEntry>) => Artifact[];

const MIN_SHARE = 0.25;

/** Pick the dominant artifact(s) from a uri→count tally: the top one plus any
 *  other covering ≥25% of the hits (so work split across two repos attributes
 *  to both). Preserves the artifact object per uri. */
function pickDominant(tally: Map<string, { artifact: Artifact; n: number }>): Artifact[] {
  const entries = [...tally.values()];
  const total = entries.reduce((a, e) => a + e.n, 0);
  return entries
    .sort((a, b) => b.n - a.n)
    .filter((e, i) => i === 0 || e.n / total >= MIN_SHARE)
    .map((e) => e.artifact);
}

/**
 * Build a resolver that infers a chunk's artifacts. Primary signal: the repos
 * of the file paths touched in the chunk's tool calls. Fallback (when nothing
 * was touched): the repos of the entries' launch `cwd`. Git lookups are
 * memoized by directory across the whole grab run.
 */
export function makeArtifactResolver(): ArtifactResolver {
  const cache = new Map<string, Artifact | null>();

  const resolveDir = (dir: string): Artifact | null => {
    let art = cache.get(dir);
    if (art === undefined) {
      art = computeArtifact(dir);
      cache.set(dir, art);
    }
    return art;
  };

  const tallyInto = (tally: Map<string, { artifact: Artifact; n: number }>, dir: string) => {
    const art = resolveDir(dir);
    if (!art) return;
    const cur = tally.get(art.uri);
    if (cur) cur.n++;
    else tally.set(art.uri, { artifact: art, n: 1 });
  };

  return (entries) => {
    // Primary: repos of touched file paths (absolute paths only).
    const byPath = new Map<string, { artifact: Artifact; n: number }>();
    for (const e of entries) {
      for (const p of e.paths ?? []) {
        if (isAbsolute(p)) tallyInto(byPath, dirname(p));
      }
    }
    if (byPath.size > 0) return pickDominant(byPath);

    // Fallback: the launch cwd of the entries.
    const byCwd = new Map<string, { artifact: Artifact; n: number }>();
    for (const e of entries) {
      const c = e.cwd?.trim();
      if (c) tallyInto(byCwd, c);
    }
    return byCwd.size > 0 ? pickDominant(byCwd) : [];
  };
}

/** Merge inferred artifacts into an extraction's existing (LLM) artifacts, deduped by uri. */
export function mergeArtifacts(existing: Artifact[], inferred: Artifact[]): Artifact[] {
  const byUri = new Map<string, Artifact>();
  for (const a of [...existing, ...inferred]) {
    if (!byUri.has(a.uri)) byUri.set(a.uri, a);
  }
  return [...byUri.values()];
}
