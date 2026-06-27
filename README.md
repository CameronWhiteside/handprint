# handprint

Human decision provenance for the age of AI. *(npm package: `handprint-sh`)*

handprint captures the decisions you and your AI make (what you chose, why, and what you ruled out) and anchors them in a cryptographically signed, tamper-evident chain. Your handprint stays with your work.

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
| `handprint grab [--dry-run] [--source <id>] [--extractor <provider>]` | Extract decisions from AI transcripts |
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

handprint has two extraction modes, both of which work without signing up for anything:

- **`local`:** runs a small open-weight model (1-2 GB) on your hardware. No data leaves the machine. No API key. No quota. Uses the optional [`node-llama-cpp`](https://github.com/withcatai/node-llama-cpp) dependency. If it isn't present, handprint tells you the one-line command to add it.
- **`host`:** routes extraction through whichever AI tool is already installed (Claude Code, opencode, codex). Uses the quota you already have with that tool, with no extra authentication required.

Configure your preferred mode:

```sh
handprint config set extraction.provider local   # private, free, offline
# or
handprint config set extraction.provider host    # uses your existing tool quota
```

See [AGENTS.md](./AGENTS.md) for a full non-interactive setup guide.

## Security & privacy

- **Local by default.** Transcripts are read and analyzed on your machine. In `local` mode nothing ever leaves the host; in `host` mode the conversation is sent only to the AI tool you already use and have authenticated.
- **Secrets are scrubbed before storage.** An aggressive sanitizer redacts emails, API keys, tokens, and credential-like strings from a handprint's payload before it is written. False positives are preferred over leaks.
- **Records are signed and encrypted.** Each handprint is appended to a tamper-evident chain, signed with your local Ed25519 key, with its payload encrypted at rest.
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
