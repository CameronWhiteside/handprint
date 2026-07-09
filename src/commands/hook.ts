import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import { globalDir } from '../dirs/global.js';

// Ambient capture: an agent (e.g. Claude Code) calls `handprint hook` when it
// finishes a turn. grab is incremental (per-session watermark) and idempotent
// (content-addressed + upsert on push), so firing it often is safe — but there
// is no value in extracting on every single turn, so we debounce to at most
// once per interval and spawn the actual grab DETACHED so the agent is never
// blocked.

const DEFAULT_INTERVAL_S = 900; // 15 min

export interface HookOptions {
  intervalSeconds?: number;
  now?: number;
  /** Root the ambient chain is stored in. Defaults to $HANDPRINT_ROOT then $HOME. */
  root?: string;
  /** Injectable launcher (defaults to a detached grab) — lets tests assert the
   *  debounce without spawning a process. */
  launch?: (root: string) => void;
}

export interface HookResult {
  ran: boolean;
  reason: 'spawned' | 'debounced';
}

function defaultLaunch(root: string): void {
  // Re-invoke this same binary so the hook works regardless of how it was
  // installed. Detached + unref so `handprint hook` returns instantly.
  const child = spawn(process.argv[0], [process.argv[1], 'grab', '--push', '-y'], {
    cwd: root,
    detached: true,
    stdio: 'ignore',
  });
  child.unref();
}

export function hook(options: HookOptions = {}): HookResult {
  const intervalMs = (options.intervalSeconds ?? DEFAULT_INTERVAL_S) * 1000;
  const now = options.now ?? Date.now();
  const stampPath = join(globalDir(), '.hook-last');

  const last = existsSync(stampPath) ? Number(readFileSync(stampPath, 'utf-8').trim()) : 0;
  if (Number.isFinite(last) && last > 0 && now - last < intervalMs) {
    return { ran: false, reason: 'debounced' };
  }

  // Stamp before launching so a burst of hook calls debounces even while the
  // detached grab is still running.
  writeFileSync(stampPath, String(now), 'utf-8');

  const root = options.root ?? process.env['HANDPRINT_ROOT'] ?? homedir();
  (options.launch ?? defaultLaunch)(root);
  return { ran: true, reason: 'spawned' };
}
