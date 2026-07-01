# Changelog

All notable changes to handprint are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.5.0] - 2026-07-01

### Changed
- Extraction now decomposes each human decision into many tiny, standalone marks (typically 4-8 per decision) instead of one long sentence. Notes target ~5 words; `MARK_NOTE_MAX` dropped from 280 to 48 (over-length notes are truncated, never dropped). The `vision` / `choice` / `method` taxonomy is unchanged.

### Added
- `TAXONOMY` in `@handprint/types`: a single source of truth mapping every type and subtype to a concise, human-centered definition. The extraction prompt interpolates it as a glossary (so the model learns what each subtype means), and it is available to consumers (e.g. handprint-web) for subtype definitions.

## [0.4.9] - 2026-06-30

### Added
- `handprint grab [path]` takes an optional directory that sets where the handprints are stored (the local chain), defaulting to the current directory. Use `handprint grab .` or `handprint grab ~/project`. `--project <name>` still controls which sessions are grabbed; the path controls where they land.

## [0.4.8] - 2026-06-30

### Added
- `handprint reset`: deletes the local handprint chain (objects, log, and grab watermark) so you can re-ingest from scratch. Requires a hard confirmation (type "reset"); `--force` skips it for scripts. Your identity, signing keys, and handprints already published to the hub are not affected.

### Changed
- Extraction now fails fast. A failure on the very first chunk (wrong engine, missing runtime, unparseable output) stops the run immediately with an actionable message instead of grinding through every chunk and session before reporting zero. Host extraction throws on genuinely unparseable output (rather than silently returning nothing), so the fail-fast can trigger and `HANDPRINT_DEBUG=1` shows the raw output.

## [0.4.7] - 2026-06-30

### Fixed
- Host extraction (claude / opencode / codex) reported "no decisions found" even when the model produced valid output. Host models wrap the JSON array in a markdown ```json code fence, and the parser required the response to start exactly with `[`, so every result was silently dropped. The host path now strips code fences and tolerantly scans for the JSON array (each mark is still validated by the zod schema). Added `HANDPRINT_DEBUG=1` to print the raw model output, and a single retry that asks for a bare array when the model returns no JSON at all.

## [0.4.6] - 2026-06-30

### Changed
- `handprint login` now signs you in through a browser loopback instead of a manual code. It opens GitHub sign-in (the one-time user code rides in the OAuth state, so there is nothing to type), runs a localhost loopback server that lands you on a success page, and finishes automatically. Polling remains the source of truth, so login still works over SSH or when a browser cannot open. This replaces the device-code prompt and the broken verification page.

## [0.4.5] - 2026-06-30

### Added
- `handprint init` now installs the bundled `/handprint` Claude Code skill into `~/.claude/skills/handprint/` automatically when `~/.claude` already exists. If it does not, a tip is printed to run `handprint skill install` after installing Claude Code.
- Silent auto-resync: every CLI invocation checks whether the installed skill matches the current CLI version and re-copies it when the version has changed or the file is missing. This means `npm i -g handprint-sh@latest` upgrades the skill automatically. Set `HANDPRINT_NO_SKILL_SYNC=1` to disable.
- `handprint skill install [--project] [--force]`: explicitly install the bundled skill into `~/.claude/skills/handprint/` (global, default) or `.claude/skills/handprint/` (project scope with `--project`).
- `handprint skill uninstall [--project]`: remove the skill directory.

## [0.4.4] - 2026-06-29

### Added
- A Claude Code skill at `skills/handprint/SKILL.md` (shipped in the npm package). Run `/handprint` (or say "handprint this") to capture and publish from inside your agent: it asks how far back, previews the size with `grab --dry-run`, then runs `grab` (extract, sign, store) and `push` (publish as unlisted), logging in if needed. It is purely an orchestration of the existing CLI primitives, with no background behavior and no new CLI commands.

## [0.4.3] - 2026-06-29

### Added
- `grab` plan now prints a rough input-token estimate: the scan step shows `~N model calls, ~Xk input tokens` so you can gauge cost before confirming. For host engines the line notes the tokens are billed to your quota; for on-machine engines it notes nothing is billed.
- The extractor line in the grab plan now names the agent by brand (e.g. `host:claude (Claude Code)`) and says whether it runs locally or bills a quota.
- Host engine model selection via `extraction.model`: passes `--model <model>` to the claude CLI. The claude host engine now defaults to the cheap, fast `haiku` model (extraction is a structured task, so this avoids inheriting an expensive Opus default); override with `handprint config set extraction.model sonnet --global`. The chosen model is recorded in the extractor label (for example `host:claude:haiku`).
- Blocked runs (engine not ready) now show the full plan and estimate before the error, so you can see the scope and decide which alternative to use.
- The local-engine block message now names any agent CLI already on PATH (e.g. "or use your installed agent (Claude Code)") so the ready alternative is obvious.

## [0.4.2] - 2026-06-29

### Added
- `ollama` extraction provider: handprint POSTs to a local OpenAI-compatible server (Ollama by default, also LM Studio, llama.cpp server, vLLM). No model download and no native addon; the server owns the model. Set with `handprint config set extraction.provider ollama --global` (`openai` is an accepted alias); default server `http://localhost:11434/v1`. Configure model, baseUrl, and apiKey via `extraction.*` keys.
- `handprint grab` time and message filters: `--days <n>`, `--since <when>`, `--until <when>` (ISO date such as 2026-06-01, or relative such as 7d / 24h), and `--min-messages <n>`.
- Always-on progress during processing: a per-session line with new-message and chunk counts, an overall `chunks done / total, percent, and ETA`, and a one-line hint for what to do if a run is slow (Ctrl-C is safe, then narrow with the filters).

### Changed
- `handprint grab` is now incremental and idempotent. It keeps a per-session watermark in `.handprint/grabbed.json` and on each run processes only messages newer than the last grab, re-grabbing a session only when it has new activity. Overlapping windows (for example last 2 days, then last 4 days) never re-grab the same work. `--redo` forces a full re-grab. The plan and confirm step report what was skipped and why (already grabbed, no new activity, below `--min-messages`, or outside the time window).
- Local extraction now preflights its runtime: if `node-llama-cpp` is not installed, `grab` stops immediately with one clear message and the fix, instead of downloading a multi-GB model and then failing on every chunk. Host mode preflights for an installed CLI. The unpinned-checksum notice was reworded.

## [0.4.0] - 2026-06-29

### Changed
- **Visibility moved to the hub.** `VISIBILITY_LEVELS`, `visibilitySchema`, and the `Visibility` type are no longer part of `@handprint/types`; `projectConfigSchema` no longer has a `visibility` field; `handprint init` no longer accepts `--visibility`; `handprint status` no longer shows a visibility line; `handprint push` always pushes (no private gating). Visibility (private / unlisted / public) is a handprint.sh hub concept that you set from the dashboard after pushing. New handprints default to unlisted.
- `socialLinkSchema` in `@handprint/types` no longer carries a `visibility` field.
- **`handprint grab` is now scan, confirm, then process.** It scans first with no model calls, shows a per-project plan (sessions, messages, chunks, and the active extractor), and asks before processing. A bare `grab` with no interactive terminal scans and stops instead of running unattended.

### Added
- `grab` targeting and safety flags: `--project <name>` to scope by project path, `-y`/`--yes` to skip the confirm step (for agents and scripts), and a true no-model `--dry-run` quick scan. Plus clearer per-session progress and an elapsed-time summary.
- `docs/HUBS.md`: the hub-agnostic origin model (configurable `hub.url` plus device auth) and the self-host roadmap.

## [0.3.0] - 2026-06-27

### Added
- **Multi-source transcript discovery.** Pluggable source adapters: `claude-code` and `opencode` are fully supported; `codex` and `cursor` are scaffolded. `handprint sources` lists adapters, their locations, capabilities, and session counts.
- **Local, account-free extraction.** Two providers: `local` (a small open-weight model via the optional `node-llama-cpp` dependency, with grammar-constrained JSON output) and `host` (routes through an installed Claude Code / opencode / codex CLI). No Cloudflare, no API key, no sign-up.
- **Provenance split.** Records now distinguish `source.agent` (which tool's transcript) from `source.extractor` (which model produced the marks).
- `grab --source <id>` and `--extractor <local|host>` flags; `extraction.*` config keys.
- `docs/CONTRIBUTING.md`: dev setup, the source-adapter interface with a worked example, and the source roadmap.

### Changed
- **Hardened extraction prompt.** Defines what a handprint is, grounds every enum in the `@handprint/types` Zod schema (so the prompt cannot drift from validation), and adds explicit prompt-injection defenses. Transcripts are fenced as untrusted data and forged delimiters are stripped.
- `node-llama-cpp` is NOT a runtime dependency. It is installed manually for local mode (`npm i -g node-llama-cpp`). If it is absent when the local model is requested, handprint prints that install hint and exits.
- Package metadata completed for npm publishing (license, repository, keywords, engines).

### Removed
- The Cloudflare Workers AI extraction path and its account requirement.
