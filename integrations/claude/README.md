# Claude Code integration

Everything in this directory is **specific to [Claude Code](https://claude.com/claude-code)**. The core `handprint` CLI is agent-agnostic (it also reads opencode and codex transcripts); Claude-only assets live here so the boundary stays clear.

```
integrations/claude/
  skills/handprint/SKILL.md   the /handprint Claude Code skill (bundled + auto-synced by the CLI)
  settings.snippet.json       Stop-hook config for ambient capture
```

## Skill

The CLI installs and keeps this skill in sync automatically (`~/.claude/skills/handprint`). You normally don't touch it. To manage it by hand:

```sh
handprint skill install     # or: handprint skill uninstall
```

## Ambient capture (Stop hook)

`handprint hook` captures as you work, without waiting for a session to end — useful for long-running sessions. Wire it to Claude Code's **Stop** hook (fires each time Claude finishes a turn):

Merge `settings.snippet.json` into `~/.claude/settings.json` (or a project `.claude/settings.json`).

It's safe to fire constantly: `handprint hook` is **debounced** (runs at most once every 15 min, tune with `--interval <seconds>`) and launches the grab **detached**, so Claude is never blocked. And grab itself is **incremental** (a per-session watermark means only new messages are processed) and **idempotent** (handprints are content-addressed and pushes upsert), so nothing is ever captured twice.

By default the ambient chain is stored in `$HOME` (override with `HANDPRINT_ROOT`). For a timer-based alternative to the Stop hook, see [`docs/CAPTURE.md`](../../docs/CAPTURE.md).
