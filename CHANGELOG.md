# Changelog

All notable changes to handprint are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

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
