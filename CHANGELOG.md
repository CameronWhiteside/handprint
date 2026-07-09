# Changelog

All notable changes to handprint are documented here. This project adheres to [Semantic Versioning](https://semver.org/).

## [0.9.2] - 2026-07-09

### Changed
- **`host` is now the default extractor when an agent CLI (claude/opencode/codex) is on your PATH** — fast, no multi-GB model download, no slow CPU inference. Falls back to the local model only when there's no agent to defer to. An explicit `--extractor` or a configured provider still wins.
- **Much nicer terminal output.** `grab` no longer sits silently: it shows a "Scanning your transcripts…" status, a branded header, and a live **progress bar** with a spinner, percentage, chunk count, and ETA during extraction. Marks print color-coded by type (vision/choice/method). All styling is stripped automatically for non-TTY output (agents, CI, pipes) and honors `NO_COLOR`.
- Before a large first capture, `grab` suggests starting smaller with `--days 7` / `--project <name>` (it's incremental, so re-running continues where it left off). And if a local run's ETA blows past 30 minutes mid-way, it prints a one-time nudge to switch to `--extractor host`/`anthropic`.

## [0.9.1] - 2026-07-09

### Fixed
- **Windows: `--extractor host` no longer fails with `spawn claude ENOENT`.** npm installs `claude` as a `.cmd` shim, which Node's spawn can't find by bare name. The runner now resolves the real binary (via `where`/`which`) and, on Windows, runs `.cmd`/`.bat` shims through `cmd.exe`. To make this safe (the transcript is untrusted and can exceed Windows' command-line length limit), the prompt is now delivered over **stdin** on every platform and only trusted flags go on the command line; a token guard rejects any unsafe argv on the Windows shim path.
- **Windows/agents: the local-model download is no longer stuck behind a TTY.** The download prompt returned "no" in any non-interactive shell, so `grab` failed forever with "model not available" — even under `-y`. Now `-y`/`--yes` (or `HANDPRINT_AUTO_DOWNLOAD=1`) auto-consents to the download, and the non-interactive error names both, instead of implying a retry will work.

### Changed
- Local extractor logs its compute backend (CPU vs GPU) on load, and `grab` warns before a large local batch that CPU inference can take hours and points to the faster `--extractor host` / `--extractor anthropic` paths.

## [0.9.0] - 2026-07-09

### Removed
- **All automatic capture: the agent Stop-hook and the launchd timer.** `handprint hook`'s debounce was a plain timestamp file, so with several concurrent agent sessions, simultaneous Stop events could race past the check and each spawn their own detached `grab --push`, piling up memory-hungry processes instead of one run. The launchd timer avoided that specific race but was still a background process capturing and encrypting conversation content on a schedule. Capture is now purely manual: run `handprint grab` yourself whenever you want to pick up new work — it's incremental and idempotent, so re-running often is cheap. `integrations/claude/settings.snippet.json` and `scripts/` (the launchd plist + capture script) are removed; README, CAPTURE.md, and the `/handprint` skill no longer mention either.

## [0.8.3] - 2026-07-09

### Changed
- Mark notes may now be up to 64 characters (was 48). The extraction prompt still asks the model to aim for ~48 (`MARK_NOTE_TARGET`), but the hard cap (`MARK_NOTE_MAX`) is 64, so a slightly-longer note is kept intact instead of truncated. Requires `@handprint/types` 0.3.3.

## [0.8.2] - 2026-07-09

### Changed
- `handprint push` now surfaces *why* handprints were skipped (the batch API's per-item error reasons, or a failed batch's message) instead of only a silent count — so push failures are diagnosable. Pairs with the hub's batch endpoint now validating per-item (a single malformed handprint no longer rejects the whole batch).

## [0.8.1] - 2026-07-08

### Changed
- Setup guidance now documents ambient capture: `handprint init` prints next steps including the Stop-hook option, the README has a "Capture as you work" section, and the `/handprint` skill can offer to enable the hook. (Version bump propagates the updated skill via auto-sync.)

## [0.8.0] - 2026-07-08

### Added
- **`handprint hook`** — ambient capture for long-running sessions. Wire it to an agent's Stop hook (e.g. Claude Code) and it captures as you work, no session-end required. Debounced (>=15 min, `--interval` to tune) and runs the grab detached, so it never blocks the agent; safe to fire constantly because grab is incremental + idempotent. Settings snippet in `integrations/claude/`.

### Changed
- **Isolated Claude-specific assets under `integrations/claude/`.** The bundled `/handprint` skill moved from `skills/` to `integrations/claude/skills/`, joined by the Stop-hook `settings.snippet.json` and an integration README. The core CLI stays agent-agnostic; the published package now ships `integrations/` instead of `skills/`. Skill install/auto-sync behavior is unchanged.

## [0.7.0] - 2026-07-08

### Added
- **Native Anthropic extractor** (`--extractor anthropic`). Uses the Anthropic Messages API with the (large, unchanging) system prompt in a `cache_control` block, so after the first call the taxonomy + examples are served from Anthropic's prompt cache — you stop paying to resend the full prompt every chunk, and it's fast (no per-call process boot like `host`). Pay-per-token via your API key; use `host` for the free Claude-subscription path. Defaults to `claude-haiku-4-5-20251001`; override with `--model`.
- **`--api-key <key>`** flag on grab (also settable via `handprint config set extraction.apiKey`), for the anthropic and openai-compatible extractors.

## [0.6.2] - 2026-07-08

### Fixed
- Host extractor (`--extractor host`): `claude -p` blocked ~3 seconds per chunk waiting on stdin even though the prompt is passed as an argument. The child's stdin is now closed immediately, removing the per-chunk stall (and the occasional stdin-timeout failure) — a large speedup on big backfills.

## [0.6.1] - 2026-07-08

### Added
- `handprint purge`: delete all your handprints from the hub (with a typed confirmation, or `--force`). Pairs with `handprint reset` (which clears the local chain) for a clean re-grab — e.g. to re-attribute existing history now that grab infers artifacts.

## [0.6.0] - 2026-07-08

### Added
- **Batch push.** `handprint push` now sends handprints to the hub in batches of up to 500 (one request per batch) instead of one request per handprint, and retries on rate-limit / transient errors with backoff (honoring `Retry-After`). A backfill of thousands of handprints that used to 429 now lands in seconds. Backed by the hub's new `POST /api/v1/push/handprints` endpoint.
- **`handprint grab --push`.** Grab and publish in one step — the basis for scheduled, mid-session capture (no need to wait for a session to end).
- **Artifact inference.** Grab now attributes each handprint to the repo it actually changed, inferred from the file paths touched in the conversation's tool calls (falling back to the launch `cwd` when nothing was touched). A session launched from `~` that edits three repos produces handprints attributed to all three — instead of everything landing in "other". GitHub remotes resolve to `org/repo`; local-only projects become `local/<name>`.
- **`handprint grab --concurrency <n>`.** Extract multiple chunks per session in parallel (default 1; keep at 1 for the local llama provider, raise it for `host`/`openai`). Plus `--base-url` and `--model` to point the openai-compatible extractor at any endpoint.

## [0.5.4] - 2026-07-07

### Changed
- GBNF grammar enums (mark types and subtypes) are now derived from `@handprint/types` instead of being hand-maintained in the extractor, so the local model's grammar can never drift from the taxonomy.
- Trimmed visibility language from the CLI copy and chilled the README (removed the Contributor Covenant code of conduct).

## [0.5.3] - 2026-07-06

### Fixed
- The local extractor reloaded the model from disk once per chunk, so a multi-chunk session paid the full load cost repeatedly. The model is now loaded once and reused across all chunks in a run. Also silenced a noisy tokenizer warning.

## [0.5.2] - 2026-07-06

### Fixed
- The local extractor's GBNF grammar failed to parse under llama.cpp when rules spanned multiple lines. Grammar rules are now collapsed to single lines so the parser accepts them.

## [0.5.1] - 2026-07-01

### Fixed
- Handprints were stamped with build time instead of chat time. The extractor already returns a per-extraction timestamp copied from the transcript, but `grab` never passed it through to `buildHandprint`, so every handprint landed on "today" and the contribution garden showed a single cell instead of your real history. `grab` now passes the extraction timestamp through, and `buildHandprint` normalizes it (falling back to now() only when the timestamp is missing or invalid). Timestamps with no timezone suffix (as some host models emit, for example `2026-06-02T16:49:50`) are treated as UTC instead of being silently reinterpreted as local time.
- Repetitive near-duplicate marks: a single grab could produce two or three chips for the same decision when a chunked session re-described it slightly differently across chunks. Extractions are now deduped across a session's chunks: marks with the same type and subtype whose normalized notes overlap significantly are collapsed, keeping the first occurrence.
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
