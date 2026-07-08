# Capturing at scale

Two flows: a one-time **backfill** of your whole history, then ongoing
**incremental capture** so new work shows up on its own.

Both rely on grab being incremental — a per-session watermark means every run
only processes messages newer than the last run. Re-running is cheap and safe.

## One-time backfill

Point grab at all your history and publish in one step. Choose an extractor:

- `--extractor host` — uses your logged-in `claude` CLI (your Claude
  subscription, no per-token cost). Best marks; subject to your plan's usage
  limits, so a huge backfill runs in bursts. Raise `--concurrency` cautiously
  (2 is plenty — each chunk spawns a CLI process).
- `--extractor ollama --base-url http://localhost:11434/v1 --model qwen2.5:3b`
  — fully local, no account limits, `--concurrency 4` safe.
- `--extractor openai --base-url <endpoint> --model <model>` (needs the
  endpoint's API key in your config) — fastest; `--concurrency 8` fine.

```bash
cd "$HANDPRINT_ROOT"          # where your handprints are stored
handprint grab --push -y --extractor host --concurrency 2
```

Push batches to the hub automatically (500 per request, retried on rate
limit). If a run is interrupted, just run it again — it resumes from the
watermark. Artifacts (which repo each handprint belongs to) are inferred from
the files each conversation touched, so nothing lands in "other" that has a
real repo behind it.

## Ongoing incremental capture (long-running sessions)

You don't need a session to end. Run grab on a schedule; the watermark keeps
each run to just the new messages.

```bash
cp scripts/sh.handprint.grab.plist ~/Library/LaunchAgents/
# edit the REPLACE_ME paths + HANDPRINT_ROOT first
launchctl load ~/Library/LaunchAgents/sh.handprint.grab.plist
```

It runs `scripts/handprint-capture.sh` every 30 min at low priority, with a
lock so runs never overlap. It defaults to the **local** extractor so scheduled
capture stays off your Claude subscription while you work — reserve
`--extractor host` for the backfill.
