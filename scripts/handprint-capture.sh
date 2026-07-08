#!/usr/bin/env bash
# Incremental capture for long-running sessions.
#
# handprint's grab is incremental (a per-session watermark means each run only
# processes new messages), so "capture as I work" is just running grab on a
# schedule — no need to wait for a session to end. Run this from launchd/cron
# every ~30 min. A lock dir makes overlapping runs no-op, so a slow run never
# stacks on the next tick.
#
# Config via env:
#   HANDPRINT_ROOT   where handprints are stored (the local chain). Required.
#   HANDPRINT_BIN    handprint binary (default: "handprint" on PATH).
#   HANDPRINT_EXTRACTOR  extractor for scheduled runs (default: local — keeps
#                    the run off your Claude subscription while you work; use
#                    "host" only for the one-time backfill).
set -euo pipefail

ROOT="${HANDPRINT_ROOT:?set HANDPRINT_ROOT to your handprint storage dir}"
BIN="${HANDPRINT_BIN:-handprint}"
EXTRACTOR="${HANDPRINT_EXTRACTOR:-local}"
LOCK="${TMPDIR:-/tmp}/handprint-capture.lock"

# Atomic lock: mkdir succeeds only if the dir doesn't exist.
if ! mkdir "$LOCK" 2>/dev/null; then
  echo "$(date -u +%FT%TZ) another capture run is in progress; skipping"
  exit 0
fi
trap 'rmdir "$LOCK" 2>/dev/null || true' EXIT

cd "$ROOT"
echo "$(date -u +%FT%TZ) capture start (root=$ROOT extractor=$EXTRACTOR)"
"$BIN" grab -y --push --extractor "$EXTRACTOR"
echo "$(date -u +%FT%TZ) capture done"
