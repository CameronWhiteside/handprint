# Handprint Protocol Design

**Date:** 2026-06-26  
**Status:** Draft  
**Scope:** `.handprint` directory standard, key management, provenance chains, artifact model, agent integration

## Overview

Handprint is a human decision provenance protocol. It captures the decisions humans make while working with AI agents, signs them cryptographically, and publishes structured provenance to a hub. `.handprint` is to handprint.sh what `.git` is to GitHub.

The protocol is agent-first and tool-agnostic. Any AI coding/creation tool (Claude Code, Cursor, Codex, Lovable, Bolt) can participate by calling the same CLI commands a human would.

## Principles

- **Decisions + outcomes = value.** Marks capture decisions. Artifacts capture outputs. The link between them is provenance.
- **Privacy first.** Conversations stay local, encrypted. Only structured metadata (marks, artifacts) is published.
- **Single source of truth.** All types live in `@handprint/types`. AGENTS.md is a pointer, not a manual.
- **Immutable once signed.** Handprints are never modified after signing. Resolutions are separate records.
- **Any agent, any output.** Not git-specific. Works with any tool that produces digital artifacts.

## Two-Tier Directory Structure

### Global: `~/.handprint/`

Identity, keys, auth, and transcript source registry. Created once via `handprint init --global` or on first `handprint init` in any project.

```
~/.handprint/
├── keys/
│   ├── id_ed25519           # 32-byte Ed25519 private key (base64url)
│   └── id_ed25519.pub       # 32-byte Ed25519 public key (base64url)
├── config.json              # Identity (handle, name), hub URL, default visibility
├── credentials.json         # Hub auth tokens (encrypted with derived AES key)
└── sources/                 # Registered transcript sources
    ├── claude-code.json     # { path, lastScanned, format }
    ├── cursor.json
    └── ...
```

### Per-Project: `.handprint/`

Project-specific state. Created via `handprint init` in a project directory.

```
.handprint/
├── config.json              # { visibility, version, createdAt }
├── objects/                 # Content-addressable handprint store
│   └── ab/cd...            # SHA-256-prefixed JSON objects
├── refs/
│   └── HEAD                # Current chain head hash
├── log                      # Append-only hash list (one per line)
├── AGENTS.md               # Minimal pointer file (checked into git)
└── .gitignore              # Tracks AGENTS.md + config; ignores objects/refs/log
```

**What gets checked into version control:** `config.json`, `AGENTS.md`, `.gitignore`  
**What stays local:** `objects/`, `refs/`, `log`

## Key Management

### Single Keypair, Two Functions

One Ed25519 keypair serves both signing and encryption via standard key derivation:

- **Signing:** Ed25519 directly (32-byte keys, 64-byte signatures)
- **Encryption:** Derive X25519 from Ed25519 (libsodium `crypto_sign_ed25519_sk_to_curve25519`), then AES-256-GCM with HKDF-derived symmetric key

Total key material: 32 bytes private + 32 bytes public. Base64url-encoded = 43 characters each.

### Key Generation

On `handprint init --global` (or first `handprint init`):

1. Generate 32-byte random seed
2. Derive Ed25519 keypair from seed
3. Write `~/.handprint/keys/id_ed25519` (private, file mode 0600)
4. Write `~/.handprint/keys/id_ed25519.pub` (public)
5. Public key published to hub on first `handprint push`

### Key Usage

- **Signing:** Every handprint object is signed with the Ed25519 private key. Anyone with the public key can verify.
- **Encryption:** Sanitized conversation payloads are encrypted with AES-256-GCM using a key derived from the Ed25519 private key via HKDF. Only the key owner can decrypt.

## Handprint Object Model

A handprint is a signed, immutable record of human decisions from an AI interaction.

### Schema

```typescript
const HANDPRINT_OBJECT_VERSION = 1 as const;

const handprintObjectSchema = z.object({
  v: z.literal(HANDPRINT_OBJECT_VERSION),
  ts: z.string(),

  marks: z.array(markSchema).min(1),
  artifacts: z.array(artifactSchema),

  source: z.object({
    agent: z.string(),
    extractor: z.string().optional(),
    session: z.string().optional(),
  }),

  payload: z.string(),
  parent: z.string().nullable(),
  sig: z.string(),
  pubkey: z.string(),
});
```

### Fields

| Field | Description |
|-------|-------------|
| `v` | Schema version (integer). Enables forward migration. |
| `ts` | ISO 8601 timestamp of when the decision was made (local time). |
| `marks` | Array of typed decisions. Each mark: `{ type, subtype, note }`. |
| `artifacts` | Array of outputs this decision influenced. Each: `{ type, uri, hash?, parent? }`. |
| `source.agent` | The agent/tool interacted with: `'claude-code/opus-4-8'`, `'lovable/v2'`, `'cursor'`. |
| `source.extractor` | The model that extracted the handprint: `'claude-haiku-4-5'`, `'llama-3.1-8b'`. |
| `source.session` | Session ID for grouping multiple handprints from one conversation. |
| `payload` | Base64-encoded AES-256-GCM ciphertext of sanitized user input. Never leaves machine. |
| `parent` | SHA-256 hash of the previous handprint in the chain. `null` for genesis. |
| `sig` | Base64url Ed25519 signature of `sha256(canonical(v + ts + marks + artifacts + source + payload + parent))`. |
| `pubkey` | Base64url Ed25519 public key (43 chars). |

### Marks

```typescript
const HANDPRINT_TYPES = ['vision', 'choice', 'method'] as const;
const VISION_SUBTYPES = ['goal', 'direction', 'principle'] as const;
const CHOICE_SUBTYPES = ['approval', 'override', 'rejection', 'constraint', 'inquiry'] as const;
const METHOD_SUBTYPES = ['tool', 'knowledge', 'process'] as const;

const markSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('vision'), subtype: visionSubtypeSchema, note: z.string().min(1).max(280) }),
  z.object({ type: z.literal('choice'), subtype: choiceSubtypeSchema, note: z.string().min(1).max(280) }),
  z.object({ type: z.literal('method'), subtype: methodSubtypeSchema, note: z.string().min(1).max(280) }),
]);
```

### Artifacts

```typescript
const ARTIFACT_TYPES = [
  'git-commit',
  'git-repo',
  'file',
  'url',
  'deployment',
  'c2pa',
  'custom',
] as const;

const artifactSchema = z.object({
  type: z.enum(ARTIFACT_TYPES),
  uri: z.string().min(1),
  hash: z.string().optional(),
  parent: z.string().optional(),
});
```

Artifacts are pointers, not descriptions. No label field. Human-readable names come from resolving the URI (commit message, filename, page title).

## Provenance Chain

Each handprint references its parent by hash, forming a Merkle chain:

```
genesis(parent=null) ← h₁(parent=hash₀) ← h₂(parent=hash₁) ← HEAD
```

### Chain Operations

**Append (`handprint grab`):**
1. Scan transcript sources for new conversation chunks
2. Extract marks via lightweight extractor model
3. Enrich with artifacts (git commits, files, etc.)
4. Sanitize user inputs (strip PII, secrets, system messages)
5. Encrypt sanitized input with derived AES key
6. Build canonical JSON: sorted keys, no whitespace, deterministic
7. SHA-256 hash the canonical representation
8. Sign hash with Ed25519 private key
9. Set `parent` to current HEAD
10. Store in `.handprint/objects/<prefix>/<hash>.json`
11. Update `.handprint/refs/HEAD`
12. Append hash to `.handprint/log`

**Verify (`handprint verify`):**
1. Walk chain from HEAD to genesis
2. For each: re-canonicalize → re-hash → verify Ed25519 signature against pubkey
3. Verify parent hash matches previous link
4. Report broken links or tampered objects

**Push (`handprint push`):**
1. Read unpushed handprints (compare local log to hub state)
2. For each: send `{ v, ts, marks, artifacts, source, parent, sig, pubkey }` to hub API
3. `payload` is NEVER sent. Conversations stay local.
4. Hub stores and indexes marks, artifacts, source for querying

## Privacy Model

### Per-Project Visibility

Set in `.handprint/config.json`:

```json
{
  "version": "1.0.0",
  "visibility": "private",
  "createdAt": "2026-06-26T..."
}
```

Values: `private` (default), `unlisted`, `public`.

- **private:** Handprints stored locally only. `handprint push` skips this project.
- **unlisted:** Pushed to hub but not indexed in public search/profiles. Accessible by direct link.
- **public:** Pushed, indexed, visible on profile and in search.

### What Never Leaves the Machine

- Raw conversation text (even sanitized)
- Private signing key
- Encryption key (derived from private key)
- `.handprint/objects/` contents

### What Gets Published

- Structured marks (type, subtype, note)
- Artifact references (URIs, hashes)
- Source metadata (agent, extractor, session)
- Timestamps
- Signature + public key (for verification)
- Chain linkage (parent hashes)

## Agent Integration

### AGENTS.md

Minimal pointer file, checked into version control. Under 100 tokens:

```markdown
# Handprint

Decision provenance. Run `handprint grab` after significant decisions.

- Types/schemas: `@handprint/types` (npm)
- CLI: `handprint --help`
- Docs: handprint.sh/docs
```

### Downloadable Skills

Detailed extraction prompts, type breakdowns, and examples live in installable skill packages, not in AGENTS.md. Skills are versioned with the protocol and pulled on demand.

### Installation Flow

1. Human says "install handprint" or visits handprint.sh
2. `npm install -g handprint` (or equivalent)
3. `handprint init --global` generates keys in `~/.handprint/`
4. `handprint login` authenticates with the hub (device auth flow)
5. `handprint init` in a project creates `.handprint/` with config + AGENTS.md
6. Agent tools discover `.handprint/AGENTS.md` and know to call `handprint grab` after decisions

## CLI Commands

```
handprint init [--global]    # Set up ~/.handprint/ (global) or .handprint/ (project)
handprint login              # Device auth flow → store token in ~/.handprint/credentials.json
handprint grab               # Scan sources, extract handprints, store locally
handprint push               # Publish local handprints to hub (respects visibility)
handprint status             # Chain state, unpushed count, auth status
handprint log                # List local handprints
handprint show <ref>         # Display a handprint by hash
handprint verify             # Validate chain integrity
handprint config show|get|set  # Manage config (global or project)
```

## Hub API Integration

The hub API (`handprint-api`) receives pushed handprints and serves profiles:

- `POST /v1/push/handprint` — accepts the handprint object (minus payload)
- `GET /v1/profiles/:handle/handprints` — query with filters on marks (via JSONB @> containment)
- `GET /v1/profiles/:handle/heatmap` — daily activity for contribution graphs
- `GET /v1/search` — full-text search across mark notes

The hub indexes marks, artifacts, and source metadata. It never receives conversation payloads.

## Migration Path

Schema version (`v`) enables forward migration:

1. When `@handprint/types` changes, bump `HANDPRINT_OBJECT_VERSION`
2. Extractor uses the new schema for new handprints
3. Old handprints remain valid — their `v` tells parsers which schema to use
4. Users can decrypt old payloads with their key and re-extract with the new schema if desired

## Implementation: Schema Migration

The current `@handprint/types` package has fields that this design replaces:

| Remove from handprint schema | Replaced by |
|-----|-----|
| `intent`, `risk`, `context` | `marks[].note` (each mark carries its own explanation) |
| `repo`, `branch`, `project` | `artifacts[]` (these are artifact references) |
| `confidence`, `horizon` | Removed (too academic; marks are concrete) |
| `outcome`, `anchors` | Removed from core (future: resolution records) |
| `status`, `resolutions` | Removed from core (future: resolution records) |

| Add to handprint schema | Purpose |
|-----|-----|
| `artifacts[]` | Output references with URI + hash + hierarchy |
| `source.agent` | Agent/tool interacted with |
| `source.extractor` | Model that extracted the handprint |
| `source.session` | Session grouping |
| `payload` | Encrypted sanitized conversation (local only) |
| `v` | Schema version for forward migration |

The inheritance chain: `@handprint/types` (Zod schemas) -> CLI tooling -> API (Drizzle schema + routes) -> Hub site.

## What This Design Does NOT Cover

- Hub site (handprint.sh) UI/UX — separate spec
- Specific extractor prompts and AI extraction logic — lives in skill packages
- Attestations / peer signatures — future extension
- C2PA manifest embedding — future extension, artifact type already supports it
- Resolution records (did the decision play out?) — future extension, separate from immutable handprints
