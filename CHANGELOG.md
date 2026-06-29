# Changelog

All notable changes to handprint are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.4.2] - 2026-06-29

### Added
- `openai` extraction provider: handprint POSTs to any local OpenAI-compatible server (Ollama, LM Studio, llama.cpp server, vLLM). No model download and no native addon. Set with `handprint config set extraction.provider openai --global`; default server is `http://localhost:11434/v1`. `--extractor ollama` is accepted as an alias. Configure model, baseUrl, and apiKey via `extraction.*` config keys.
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
