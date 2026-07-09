# handprint

A signed, hash-linked record of the human decisions behind your AI-assisted work. *(npm package: `handprint-sh`)*

handprint captures the decisions you and your AI make (what you chose, why, and what you ruled out) and records them in a hash-linked chain, each entry signed with your local key. Your handprint stays with your work.

> **Why this exists.** As AI writes more of the work, a record of who actually decided what helps keep people in the loop. handprint is built on the [Human Provenance Covenant](./COVENANT.md): respect people's data, credit their judgment, and use their provenance to benefit *them* rather than to train systems that route around them. See [License & Covenant](#license--covenant).

## Install

```sh
npm i -g handprint-sh
```

## Usage

Initialize your global identity (one time):

```sh
handprint init --global
```

Extract decisions from AI transcripts in the current project:

```sh
handprint grab
```

`grab` scans first and shows a plan grouped by project, then asks before processing anything:

- It is **incremental and idempotent**: each run processes only sessions (and only the messages) that are new since the last grab, so overlapping runs never redo work. `--redo` forces a re-grab.
- **Attributed to the right repo:** each handprint is tied to the repo it actually changed, inferred from the files touched in the conversation — so work lands under the correct project even when you launch your agent from a parent directory (a GitHub remote resolves to `org/repo`; a local-only project to `local/<name>`).
- Narrow what you process: `--days N` (or `--since` / `--until`), `--project <name>`, `--min-messages N`, `-n N`.
- Choose an extractor with `--extractor local | host | ollama | anthropic` (`--concurrency N` to parallelize). See [docs/CAPTURE.md](docs/CAPTURE.md) for the cost/speed tradeoffs and one-time backfill.
- It shows live progress and an ETA, and a bare `grab` with no terminal to confirm will scan and stop rather than run unattended. Use `-y` to skip the prompt (for agents and scripts).

Publish handprints to the hub:

```sh
handprint push
```

See your decision chain:

```sh
handprint log
handprint verify
handprint status
```

### Capture as you work (ambient)

You don't have to run `grab` by hand. Because `grab` is incremental and
idempotent, you can capture continuously — mid-session, without waiting for a
session to end:

- **Agent hook (Claude Code):** wire `handprint hook` to the Stop hook. It's
  debounced (≥15 min) and runs the grab detached, so it never blocks the agent.
  Merge [`integrations/claude/settings.snippet.json`](integrations/claude/settings.snippet.json)
  into `~/.claude/settings.json`.
- **Timer (any agent / macOS launchd):** see [`docs/CAPTURE.md`](docs/CAPTURE.md).

Both are safe to fire constantly — nothing is captured twice. Full guide, plus
one-time backfill of your whole history: [`docs/CAPTURE.md`](docs/CAPTURE.md).

## Commands

| Command | Description |
|---------|-------------|
| `handprint init [--global]` | Initialize global identity or project |
| `handprint grab [path] [--days N] [--project <name>] [--min-messages N] [--dry-run] [-y] [--extractor <engine>]` | Scan, confirm, then extract decisions (path sets where the chain is stored, default: current dir) |
| `handprint sources` | List available source adapters and their status |
| `handprint push` | Publish handprints to the hub in batches (opt-in; requires `handprint login`) |
| `handprint hook [--interval N]` | Ambient capture: debounced, detached `grab --push` for an agent Stop hook |
| `handprint reset [--force]` | Clear the local chain (objects, log, watermark) to re-ingest from scratch |
| `handprint purge [--force]` | Delete all your handprints from the hub (pairs with `reset` for a clean re-grab) |
| `handprint log` | List local handprints |
| `handprint show <ref>` | Show a handprint by hash or prefix |
| `handprint verify` | Verify chain integrity and signatures |
| `handprint status` | Chain state, auth status, key fingerprint |
| `handprint keys add --label <name>` | Register this device's key |
| `handprint keys list` | Show this device's key info |
| `handprint keys rotate` | Generate a new signing key |
| `handprint keys export` | Export your seed for backup |
| `handprint config show` | Show configuration |

## Runs entirely on your machine, no account required

handprint extracts decisions with one of three engines, none of which require signing up for anything:

- **`ollama` (recommended for local):** runs a model on a local OpenAI-compatible server: Ollama by default, or LM Studio / llama.cpp server / vLLM. Fully on-machine and private. The server owns model download and storage, so handprint downloads nothing. `--extractor openai` is an accepted alias.
- **`local`:** an embedded engine via the optional [`node-llama-cpp`](https://github.com/withcatai/node-llama-cpp) dependency. Self-contained, but handprint manages a one-time model download (about 2 GB) itself.
- **`host`:** routes through an AI tool you already have installed (Claude Code, opencode, codex). Convenient and uses your existing quota, but it runs that tool's cloud model, not a local one.

```sh
handprint config set extraction.provider ollama --global    # local + private (recommended)
handprint config set extraction.model qwen2.5:3b --global
ollama pull qwen2.5:3b
# alternatives:
#   extraction.provider local   (embedded engine, self-managed download)
#   extraction.provider host    (your installed agent; runs in the cloud)
```

For the `host` engine, the claude path defaults to the cheap, fast `haiku` model (extraction is a structured task, so this avoids burning Opus). Override it per machine:

```sh
handprint config set extraction.provider host --global
handprint config set extraction.model sonnet --global   # optional; default is haiku
```

Without `extraction.model`, the claude host engine uses `haiku`. The model is recorded in each handprint's source (for example `host:claude:haiku`) so you know what extracted it.

The grab plan always shows a rough input-token estimate and names the engine (e.g. `host:claude (Claude Code)`) so you can confirm the scope before any tokens are billed.

### Paid, cached cloud extraction (`anthropic`)

If you have an Anthropic API key and want a fast backfill without touching your
Claude subscription's usage limits, use the native Anthropic engine:

```sh
handprint config set extraction.provider anthropic --global
handprint config set extraction.apiKey sk-ant-... --global
handprint grab --extractor anthropic --concurrency 8   # or --api-key sk-ant-... inline
```

It calls the Anthropic Messages API directly (no per-chunk process boot, so it's
faster than `host`) and puts the large, unchanging system prompt in a prompt
**cache** — the first chunk writes the cache, every chunk after reads it, so you
aren't re-billed the full taxonomy + examples each time. Default model is
`claude-haiku-4-5-20251001` (extraction is a structured task); override with
`--model`. Unlike the three engines above this is pay-per-token on your API key —
for the free path use `--extractor host`.

If the chosen engine is not ready (no Ollama server, `node-llama-cpp` not installed, or no agent CLI), `grab` stops with a one-line fix instead of failing mid-run. See [AGENTS.md](./AGENTS.md) for non-interactive setup.

## The `/handprint` skill (capture from inside your agent)

handprint ships a Claude Code skill so you can leave a handprint without dropping to the terminal.

**The skill installs automatically.** `handprint init` copies it to `~/.claude/skills/handprint/`, and every subsequent CLI invocation silently re-syncs it when a newer version is available. After `npm i -g handprint-sh@latest` the skill upgrades itself on the next run.

For explicit control:

```sh
handprint skill install           # install or re-sync globally (~/.claude/skills/handprint/)
handprint skill install --project # install into the current project's .claude/skills/
handprint skill uninstall         # remove the global copy
handprint skill uninstall --project
```

Set `HANDPRINT_NO_SKILL_SYNC=1` to disable the automatic background sync.

Then in Claude Code run `/handprint` (or just say "handprint this"). The skill asks how far back to capture (Today by default), previews the size and token estimate, captures the decisions (`grab`), and publishes them (`push`), logging you in if needed. It is only an orchestration of the CLI primitives. Nothing runs in the background; capture happens when you ask.

## Security & privacy

- **Local by default.** Transcripts are read and analyzed on your machine. In `local` mode nothing ever leaves the host; in `host` mode the conversation is sent only to the AI tool you already use and have authenticated.
- **Secrets are scrubbed before storage.** An aggressive sanitizer redacts emails, API keys, tokens, and credential-like strings from a handprint's payload before it is written. False positives are preferred over leaks.
- **Records are signed, hash-linked, and encrypted.** Each handprint is appended to a chain linked by BLAKE2b-256 content hashes, signed with your local Ed25519 key, with its payload encrypted at rest (XSalsa20-Poly1305). `handprint verify` recomputes every hash, checks every signature, and confirms each entry was signed by one of your own keys (current or rotated), so a chain forged or spliced with a foreign key is rejected.
- **Scope of the guarantee.** Verification proves a chain is internally consistent and attributable to your key. It does not by itself stop the holder of your seed from rewriting their own history (re-signing a different chain). Detecting that requires an external append-only anchor; the hub will provide server-side timestamping for this, and it is on the roadmap rather than shipped today. Treat local verification as integrity-and-attribution, not third-party notarization.
- **The extractor treats transcripts as untrusted input.** Conversation text is fenced as untrusted data and the model is instructed to never follow instructions embedded in it. This defends against prompt injection from pasted or third-party content. Output is validated against a strict Zod schema, and anything off-schema is discarded.
- **Publishing is opt-in.** `handprint grab`, `log`, `verify`, and `show` are fully offline. Only `handprint push` contacts the hub, and only after `handprint login`. For fully offline use, never run `push`.

Found a vulnerability? Please open a [security advisory](https://github.com/CameronWhiteside/handprint/security/advisories/new) rather than a public issue.

## Contributing

Contributions are welcome, especially new **source adapters** so handprint can capture decisions wherever your chats happen. See [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md) for the dev setup, the adapter interface with a worked example, and the source roadmap.

## License & Covenant

The **handprint CLI** and **`@handprint/types`** are open source under **[Apache-2.0](./LICENSE)**. Run them, fork them, build on them.

Use is also subject to the **[Human Provenance Covenant](./COVENANT.md)**, a Hippocratic-style ethical commitment and the basis on which hosted-hub access is granted:

- **Respect human data and controls:** use a person's provenance to give *them* direct benefit, including credit, visibility, and opportunity based on what they've shared and decided.
- **Keep the human in the loop:** do not use it to route around or replace the very people whose decisions are being measured.

The **hub** (`handprint.sh` and its API) is aggressively rate-limited by default, and limit increases are conditional on a human-benefit review. Uses that displace the measured human stay at the floor tier until they can show the human still benefits. Full terms in [COVENANT.md](./COVENANT.md).

Apache-2.0 © Cameron Whiteside 2026
