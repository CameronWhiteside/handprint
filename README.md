# handprint

Human decision provenance for the age of AI. *(npm package: `handprint-sh`)*

handprint captures the decisions you and your AI make (what you chose, why, and what you ruled out) and records them in a hash-linked chain, each entry signed with your local key. Your handprint stays with your work.

> **Why this exists.** A record of *who decided what* should keep humans in the loop rather than erase them. handprint is built on the [Human Provenance Covenant](./COVENANT.md): respect people's data, credit their judgment, and use their provenance to benefit *them* rather than to train systems that route around them. See [License & Covenant](#license--covenant).

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
- Narrow what you process: `--days N` (or `--since` / `--until`), `--project <name>`, `--min-messages N`, `-n N`.
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

## Commands

| Command | Description |
|---------|-------------|
| `handprint init [--global]` | Initialize global identity or project |
| `handprint grab [--days N] [--project <name>] [--min-messages N] [--dry-run] [-y] [--extractor <engine>]` | Scan, confirm, then extract decisions |
| `handprint sources` | List available source adapters and their status |
| `handprint push` | Publish handprints to the hub (opt-in; requires `handprint login`) |
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

For the `host` engine you can pick which model the agent uses by passing `--model` to the CLI:

```sh
handprint config set extraction.provider host --global
handprint config set extraction.model claude-opus-4-5 --global   # optional; defaults to the agent's own default
```

Without `extraction.model` the agent (e.g. Claude Code) uses whatever model it defaults to.

The grab plan always shows a rough input-token estimate and names the engine (e.g. `host:claude (Claude Code)`) so you can confirm the scope before any tokens are billed.

If the chosen engine is not ready (no Ollama server, `node-llama-cpp` not installed, or no agent CLI), `grab` stops with a one-line fix instead of failing mid-run. See [AGENTS.md](./AGENTS.md) for non-interactive setup.

## Visibility (private / unlisted / public)

Visibility is a property of the handprint.sh hub, not of the protocol or the signed record. Nothing in the local chain or the cryptographic handprint encodes a visibility level.

When you push a handprint, the hub assigns it a visibility:

- **unlisted (default):** metadata is searchable, but the handprint does not appear on your public profile page. Share the direct link to show it selectively.
- **public:** listed on your public profile and discoverable.
- **private:** hidden; only you can see it.

You set or change visibility from the hub dashboard after pushing. The CLI does not read or write visibility.

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
