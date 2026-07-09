# Claude Code integration

Everything in this directory is **specific to [Claude Code](https://claude.com/claude-code)**. The core `handprint` CLI is agent-agnostic (it also reads opencode and codex transcripts); Claude-only assets live here so the boundary stays clear.

```
integrations/claude/
  skills/handprint/SKILL.md   the /handprint Claude Code skill (bundled + auto-synced by the CLI)
```

## Skill

The CLI installs and keeps this skill in sync automatically (`~/.claude/skills/handprint`). You normally don't touch it. To manage it by hand:

```sh
handprint skill install     # or: handprint skill uninstall
```

## Ongoing capture

There's no agent Stop-hook here. We shipped one and pulled it: its debounce
was a plain timestamp file, and with several concurrent Claude sessions,
simultaneous Stop events can race past that check and each launch their own
detached `grab --push`. For ongoing capture, use the timer-based option in
[`docs/CAPTURE.md`](../../docs/CAPTURE.md) instead — it uses a lock file, so
only one run is ever in flight.
