# AGENTS.md — handprint install guide for automated agents

This file tells an AI agent how to install and configure handprint for transcript extraction **without any interactive prompts**.

---

## 1. Install

```sh
npm i -g handprint-sh
handprint init --global
```

`init --global` creates a signing key and a default config file at `~/.handprint/config.json`. It does not require a network connection or an account.

> **No Cloudflare account, no API key, and no sign-up of any kind is required** to run handprint locally.

---

## 2. Choose an extraction provider

handprint supports two extraction providers. Set one before running `grab`:

### Option A — `local` (private, free, no quota)

Runs a small language model entirely on the machine. No data ever leaves the host. No API key. No usage quota.

```sh
handprint config set extraction.provider local
```

Then choose a model. Pick the **smallest model the machine can run**:

| Model id | Size | RAM needed | Notes |
|---|---|---|---|
| `qwen2.5-1.5b-instruct-q4` | ~1.1 GB | 2 GB | Lightest. Good for short structured extraction on 8 GB machines / no GPU. |
| `qwen2.5-3b-instruct-q4` | ~2.0 GB | 4 GB | **Recommended default.** Strong JSON adherence; fast on Apple Silicon. |
| `llama-3.2-3b-instruct-q4` | ~2.0 GB | 4 GB | Alternative 3B if Qwen output quality is poor for your transcripts. |

Default is `qwen2.5-3b-instruct-q4`. To override:

```sh
handprint config set extraction.model qwen2.5-1.5b-instruct-q4
```

The model file is downloaded automatically on first `grab` if it is not already present at `~/.handprint/models/`.

### Option B — `host` (uses the user's existing Claude / opencode / codex quota)

Routes extraction through the agent that is already running on the machine (whichever tool generated the transcripts). Uses the user's existing quota — no additional API key required as long as the host tool is authenticated.

```sh
handprint config set extraction.provider host
```

---

## 3. Scope discovery to specific sources

By default `grab` reads all implemented sources. To limit discovery to specific tools:

```sh
handprint config set extraction.sources '["claude-code","opencode"]'
```

Supported values: `claude-code`, `opencode`. (Additional sources `codex` and `cursor` are stubs — not yet functional.)

---

## 4. Run extraction

```sh
handprint grab
```

Use `--dry-run` to preview what would be extracted without writing anything:

```sh
handprint grab --dry-run
```

Filter to a single source at grab time (overrides config):

```sh
handprint grab --source claude-code
```

---

## 5. Summary — fully non-interactive setup

```sh
npm i -g handprint-sh
handprint init --global
handprint config set extraction.provider local
handprint config set extraction.model qwen2.5-3b-instruct-q4
handprint config set extraction.sources '["claude-code","opencode"]'
handprint grab
```

No account. No cloud. No prompts.
