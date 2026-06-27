# Source Adapter Roadmap

This document tracks the status of every source adapter and what is required to implement the remaining ones.

---

## Status table

| Source | Status | Default location | Capabilities |
|---|---|---|---|
| `claude-code` | **Shipped** | `~/.claude/projects/*/*.jsonl` | timestamps (iso), session, project, git-branch |
| `opencode` | **Shipped** | `~/.local/share/opencode/storage` | timestamps (epoch-ms), session, project, model |
| `codex` | **Stub** | `~/.codex/sessions` | timestamps (iso), session, project, model |
| `cursor` | **Stub** | `~/Library/Application Support/Cursor` (SQLite) | timestamps (epoch-ms), session, project, model |
| `chatgpt` | **Planned** | ChatGPT data-export ZIP | timestamps (iso), session, project (if inferred) |
| `lovable` | **Planned** | Web capture (no local file) | timestamps (iso), session |
| `generic` | **Planned** | User-defined path + format | configurable |

---

## Notes on each source

### `claude-code` (shipped)

Reads JSONL transcripts written by Claude Code under `~/.claude/projects/<encoded-path>/<session-id>.jsonl`. Each line is a JSON object whose `type` field is `user` or `assistant`. Timestamps, working directory, session id, and git branch are all present in the raw data. No additional dependencies are required.

### `opencode` (shipped)

Reads the opencode storage hierarchy at `~/.local/share/opencode/storage`. Sessions are stored as JSON files under `storage/session/`, messages under `storage/message/<session-id>/`, and message parts (text chunks) under `storage/part/<message-id>/`. The adapter walks these trees, assembles parts into full message text, and converts epoch-ms timestamps to ISO 8601. No additional dependencies are required.

### `codex` (stub: `~/.codex/sessions`, format TBD-from-disk)

Codex CLI appears to persist sessions under `~/.codex/sessions`, but the exact on-disk format has not been confirmed from a live install. To implement this adapter: run Codex, inspect the files it creates, and update `src/sources/codex.ts` with a `locate()` that globs for those files and a `parse()` that deserialises them into `TranscriptEntry[]`. Set `descriptor.implemented = true` once both methods are functional. No external npm dependencies should be necessary if the format is JSONL or plain JSON.

### `cursor` (stub: SQLite under app-support)

Cursor stores chat history in a SQLite database under `~/Library/Application Support/Cursor` (macOS) or the equivalent platform path on Windows/Linux. To implement this adapter: identify the exact database file and table schema, add a lightweight SQLite dependency (e.g. `better-sqlite3` or `@sqlite.org/sqlite-wasm`), and wire up `locate()` + `parse()` accordingly. The main challenge is that the schema is undocumented and may change between Cursor releases.

### `chatgpt` (planned: data-export JSON)

OpenAI provides a data export via Settings → Data controls → Export. The archive contains a `conversations.json` file with a full conversation tree. To implement: accept an `--import-path` pointing at the extracted archive (or a single `conversations.json`), parse the conversation tree into `NormalizedSession[]`, and map roles to `user`/`assistant`. No live API access or authentication is required — the adapter only reads the exported file. The main open question is how to model the `project` field, since ChatGPT has no concept of a working directory.

### `lovable` (planned: web — needs a capture path)

Lovable is a browser-only product with no local file storage. Implementing this source requires a capture mechanism: either a browser extension that intercepts conversation data and writes it to a local file, or a manual export flow if Lovable adds one. Once a local file (JSONL or JSON) is available, the adapter itself is straightforward. This is the only planned source where the bottleneck is data access rather than parsing.

### `generic` / open-integration story

A `generic` adapter would let users point handprint at any directory of JSONL files that match the canonical `TranscriptEntry` schema. This removes the need to write a custom adapter for niche tools. Configuration would look like:

```sh
handprint config set sources.generic.path '~/.myagent/transcripts'
handprint config set sources.generic.glob '**/*.jsonl'
```

This is the lowest-friction path for integrating a tool that handprint does not yet support natively.
