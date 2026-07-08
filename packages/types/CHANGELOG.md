# Changelog

All notable changes to `@handprint/types` are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

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
