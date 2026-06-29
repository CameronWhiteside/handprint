# Changelog

All notable changes to handprint are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

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
