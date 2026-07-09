# Changelog

All notable changes to `@handprint/types` are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.3.3] - 2026-07-09

### Changed
- Relaxed the mark-note limit: `MARK_NOTE_MAX` (schema hard cap + salvage truncation) 48 → 64, so slightly-longer notes are accepted instead of chopped. Added `MARK_NOTE_TARGET` (48) — the soft length the extraction prompt asks the model to aim for. Prompt still targets 48; validation now allows up to 64.

## [0.3.2] - 2026-07-08

### Added
- `extractionConfigSchema.provider` now accepts `"anthropic"` (native Anthropic Messages API extractor with prompt caching), alongside `local` / `host` / `ollama` / `openai`.

## [0.3.1] - 2026-07-08

### Added
- `pushHandprintsInputSchema` / `PushHandprintsInput` and `PUSH_HANDPRINTS_MAX` (500): batch push payload — many handprints in one request. Backs the new `POST /api/v1/push/handprints` endpoint and the CLI's batched push, so a large backfill lands in a handful of requests instead of one-per-handprint.

## [0.3.0] - 2026-07-08

### Added
- `TAXONOMY`: a single source of truth mapping every `vision` / `choice` / `method` type and subtype to a concise, human-centered definition. Consumed by the extraction prompt (as a glossary) and by handprint-web (as subtype definitions). Keys are enforced to match `HANDPRINT_TYPES` and `SUBTYPES_BY_TYPE` by a coverage test.
- `extractionConfigSchema` / `ExtractionConfig` on the profile config: optional `provider`, `model`, `agentCli`, `sources`, `baseUrl`, and `apiKey`.
- Artifact URI hardening: artifact `uri` values are now validated against a scheme allowlist (`http`, `https`, `git`, `ssh`, `file`). Dangerous schemes (`javascript:`, `data:`, `vbscript:`) are rejected; non-URL values (relative paths, git refs) are still accepted.

### Changed
- `MARK_NOTE_MAX` dropped from 280 to 48 to reflect the atomic-marks model (short, standalone notes). Over-length notes are truncated, never dropped.

### Removed
- **Breaking:** visibility is no longer part of the protocol types. Removed `VISIBILITY_LEVELS`, `visibilitySchema`, `Visibility`, and the `visibility` field on profile schemas. The hub owns visibility now.
- Removed the standalone `signature` module; signature types are exported from `handprint` instead.
