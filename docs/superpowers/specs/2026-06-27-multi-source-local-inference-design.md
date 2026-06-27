# Handprint — Multi-Source Discovery + Local Inference Refactor

Date: 2026-06-27
Status: Approved (design)
Branch: `whiteside/multi-source-local-inference`

## Problem

The CLI's transcript pipeline is hardwired to one source and one inference backend:

- **Discovery** (`discoverTranscripts`) only globs `~/.claude/projects/*/*.jsonl` — Claude Code only.
- **Parsing** (`parseTranscriptLine`) only understands Claude Code's JSONL shape.
- **Inference** (`src/scanner/ai-extractor.ts`) calls **Cloudflare Workers AI** and requires
  `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_API_TOKEN` or a `wrangler login`.
- `source.agent` is hardcoded to `'claude-code'`.

This violates the product's core constraint: the tool processes the user's actual chat transcripts
**on their machine**, so it **must work with no external account setup**. It also only sees one of
the many places "chat happens."

## Goals

1. **No external account, ever.** Remove the Cloudflare dependency entirely. Run on a model that is
   already on the machine (an installed agent CLI) or on a small local model we bundle the runner for.
2. **Multi-source discovery + parsing.** Pluggable source adapters. Implement and test **Claude Code**
   and **opencode** now; scaffold **codex** and **cursor**; document a roadmap for ChatGPT/Lovable/generic.
3. **Honest provenance.** Record *which agent's transcript* a handprint came from separately from
   *which model extracted it*.
4. **Explicit, documented configuration** of where each source stores transcripts and what
   data/timestamps it provides.

## Non-Goals (YAGNI)

- No ChatGPT/Lovable adapters in this pass (roadmap doc only).
- No re-introduction of any cloud inference provider.
- No Ollama-the-app dependency and no background daemon.
- No silent model download — download requires user/agent consent.

## Architecture — three layers

```
┌─ DISCOVERY ──────────┐   ┌─ NORMALIZE ──┐   ┌─ INFERENCE ─────────────┐
│ source adapters      │ → │ Transcript   │ → │ extractor providers     │
│ locate() + parse()   │   │ Entry[] +    │   │ local-model | host-agent│
│ claude, opencode,    │   │ session meta │   │ → Mark[] / Artifact[]   │
│ (codex, cursor stub) │   └──────────────┘   └─────────────────────────┘
└──────────────────────┘                              ↓
                                          builder (unchanged: sign/encrypt/chain)
```

The builder (`src/builder/handprint.ts`) and crypto/store/sanitizer layers are unchanged except for
the new provenance field.

## 1. Source adapters (`src/sources/`)

Each source is one module implementing a common interface:

```ts
interface SessionRef {
  sourceId: string;        // adapter id
  sessionId: string;
  project: string;         // human-readable project/cwd
  locator: string;         // path or key the adapter uses to load it
  mtimeMs: number;         // for recency sort
}

interface NormalizedSession {
  ref: SessionRef;
  entries: TranscriptEntry[];   // role, text, timestamp (ISO), cwd, sessionId, gitBranch
}

interface SourceAdapter {
  descriptor: {
    id: 'claude-code' | 'opencode' | 'codex' | 'cursor';
    displayName: string;
    sourceAgent: Source['agent'];   // value written to handprint.source.agent
    capabilities: {
      timestamps: 'iso' | 'epoch-ms' | 'none';
      session: boolean; project: boolean; gitBranch: boolean; model: boolean;
    };
    locations: string[];            // documented default paths, for `handprint sources`
    implemented: boolean;           // false for codex/cursor stubs
  };
  locate(opts?: { homeDir?: string }): SessionRef[];
  parse(ref: SessionRef): NormalizedSession;   // stubs throw a clear "not yet implemented" error
}
```

### Adapters in this pass

- **`claude-code`** — refactor of existing logic. Glob `~/.claude/projects/*/*.jsonl`, parse JSONL
  lines (`type` user/assistant, `message.content` text parts), timestamps already ISO. `project`
  derived from the dir name as today.
- **`opencode`** — read `~/.local/share/opencode/storage`:
  - `session/**/ses_*.json` → session id, `directory` (project), `time`.
  - `message/<sessionId>/msg_*.json` → `role`, `time.created` (epoch-ms → ISO), `path.cwd`, `modelID`.
  - `part/<messageId>/prt_*.json` → text content from parts of `type === 'text'`; ignore
    `reasoning`/`tool`/`step-*` parts.
  - Assemble messages in `time.created` order; `project` from `session.directory`.
- **`codex`** — descriptor + `locate()` for `~/.codex/sessions` where determinable; `parse()` throws
  `NotImplementedError` pointing to the adapter guide. `implemented: false`.
- **`cursor`** — descriptor noting the SQLite store under Cursor's app-support dir; `locate()`/`parse()`
  stubbed the same way. `implemented: false`.

### Shared helper

A `jsonl-glob` helper encapsulates the common "glob a directory tree of JSONL, map each line"
pattern so a future simple adapter is ~20 lines.

### Discovery

`discoverSessions(opts)` runs every **enabled & implemented** adapter's `locate()`, merges, and sorts
by `mtimeMs` desc. A `--source <id>` flag narrows to one adapter; config controls which are enabled.

## 2. Normalized model + provenance

`TranscriptEntry` keeps today's fields; **timestamps are always normalized to ISO 8601** regardless of
source. Provenance is split into two honest facts on the handprint `source` — **both fields already
exist** in `sourceSchema` (`@handprint/types`), so no schema change is required:

- `source.agent` — which tool's transcript it came from (from the **adapter** descriptor).
- `source.extractor` — which provider/model produced the marks, e.g. `"local:qwen2.5-3b-instruct"`
  or `"host:claude"` (from the **extractor** provider's `label()`).

Today `grab` hardcodes `source.agent = 'claude-code'` and never sets `source.extractor`. After this
refactor `source.agent` comes from the adapter descriptor and `source.extractor` from the provider.

## 3. Inference providers (`src/extractor/`)

Replace the Cloudflare-only path with a provider abstraction. Both providers are built and tested.

```ts
interface ExtractorProvider {
  id: string;                       // "local-model" | "host-agent"
  label(): string;                  // e.g. "local:qwen2.5-3b-instruct" — used for extractedBy
  isAvailable(): Promise<boolean>;
  extract(window: string, system: string): Promise<RawExtraction[]>;
}
```

### `local-model`

- Uses **`node-llama-cpp`** — in-process native binding to llama.cpp, prebuilt binaries with
  Metal/CUDA/Vulkan, **no daemon**, **GBNF grammar / JSON-schema-constrained output**. The grammar is
  derived from the `Mark[]`/`Artifact[]` Zod schema so output is guaranteed to parse.
- A **model registry** (`src/extractor/models.ts`) lists candidate GGUFs with download size, RAM
  estimate, and quality notes (e.g. Qwen2.5-3B-Instruct Q4 ≈ 2 GB; a ~1.5B "lite" ≈ 1 GB).
- First use lazily downloads the chosen model **after consent**. The selection prompt describes the
  extraction task and asks the user/agent to **pick the lightest appropriate model for the job**.
- Models cached under `~/.handprint/models/`.

### `host-agent`

- Shells out to an installed agent CLI — `claude -p <prompt>`, `opencode run`, or `codex exec` —
  with the same system + window prompt, and parses a JSON array from stdout.
- Reuses the user's existing auth; zero download; **spends the user's AI quota** (documented).
- Detection probes `PATH` for the known binaries.

### Selection & configuration

- First-run interactive prompt offers: download local model (default, private, free) **or** use a
  detected agent CLI (uses quota). Choice persisted via config.
- Non-interactive: `handprint config set extractor local|host`, `... model <id>`,
  `... sources <ids>`.
- A shipped **`AGENTS.md`** at the package root documents the install-time choice so an agent
  installing the package can self-configure without prompts.
- `getCloudflareAuth()` and `callWorkersAI()` are **deleted**. No `CLOUDFLARE_*` env vars are read.

## 4. CLI surface

- `handprint sources` — **new**: list adapters with display name, documented paths, capabilities,
  enabled/implemented state, and number of sessions found.
- `handprint grab [--source <id>] [--extractor local|host] [--dry-run]` — extended; `--dry-run`
  still works with no model for testing.
- `handprint config` — new keys: `extractor`, `model`, `sources`.

## 5. Where the work happens

- A **fresh clone** of `CameronWhiteside/handprint` at `~/handprint-multisource`, feature branch
  `whiteside/multi-source-local-inference` (the original checkout has in-flight work; this lands as a PR).

## 6. Testing strategy

- Per-adapter unit tests against **real on-disk samples** (Claude Code + opencode data exist locally);
  golden-parse fixtures committed (sanitized) so tests are deterministic.
- Provider tests: `host-agent` parsing tested against captured stdout fixtures; `local-model` grammar
  derivation tested without requiring a downloaded model (grammar generation is pure).
- `--dry-run` end-to-end test exercises discovery + normalize without inference.
- Gate: `pnpm run fix` (typecheck/lint) then `vitest`.

## 7. Docs delivered

- `docs/adding-a-source-adapter.md` — the adapter interface + a worked example.
- `docs/roadmap-sources.md` — ChatGPT, Lovable, generic/open integration plan.
- `AGENTS.md` — install-time extractor/model/source configuration for agent-driven installs.

## Migration / compatibility

- Existing local handprint chains are unaffected (builder/store unchanged).
- The added `source.extractedBy` field is additive and optional for reading old objects.
