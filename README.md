# handprint-sh

Human decision provenance for the age of AI.

handprint captures the decisions you and your AI make — what you chose, why, and what you ruled out — and anchors them in a cryptographically signed, tamper-evident chain. Your handprint stays with your work.

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
| `handprint push` | Publish handprints to the hub |
| `handprint log` | List local handprints |
| `handprint show <ref>` | Show a handprint by hash or prefix |
| `handprint verify` | Verify chain integrity and signatures |
| `handprint status` | Chain state, auth status, key fingerprint |
| `handprint keys add --label <name>` | Register this device's key |
| `handprint keys list` | Show this device's key info |
| `handprint keys rotate` | Generate a new signing key |
| `handprint config show` | Show configuration |

## Runs entirely on your machine — no account required

handprint has two extraction modes, both of which work without signing up for anything:

- **`local`** — downloads a small open-weight model (1–2 GB) and runs it on your hardware. No data leaves the machine. No API key. No quota.
- **`host`** — routes extraction through whichever AI tool is already installed (Claude Code, opencode, codex). Uses the quota you already have with that tool; no extra authentication required.

Configure your preferred mode:

```sh
handprint config set extraction.provider local   # private, free, offline
# or
handprint config set extraction.provider host    # uses your existing tool quota
```

See [AGENTS.md](./AGENTS.md) for a full non-interactive setup guide.

## License

MIT © Cameron Whiteside 2026
