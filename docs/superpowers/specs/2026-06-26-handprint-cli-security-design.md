# Handprint CLI Security & Installation Design

**Date:** 2026-06-26  
**Status:** Draft  
**Scope:** CLI packaging, installation security, cryptographic architecture, key management, privacy guarantees

## Overview

The handprint CLI (`handprint-sh` on npm) is the local-first tool that grabs decisions from AI conversations, signs them cryptographically, and pushes structured provenance to the hub. It handles private conversation data and cryptographic keys — security is the product, not a feature.

## Package Architecture

### npm Packages

| Package | Name | Purpose |
|---------|------|---------|
| CLI | `handprint-sh` | The product. Binary: `handprint`. Unscoped for clean install. |
| Types | `@handprint-sh/types` | Zod schemas. Source of truth for all handprint data structures. |

### Monorepo Layout

```
~/handprint/
├── packages/types/         → @handprint-sh/types
├── src/                    → handprint-sh (CLI source)
├── bin/handprint.ts        → entry point
├── tests/                  → vitest test suite
└── package.json            → name: handprint-sh, bin: { handprint: ./bin/handprint.ts }
```

### Installation Paths

**npm (Node.js users):**
```bash
npm install -g handprint-sh
handprint --version
```

Published with npm provenance (SLSA Build L3, Sigstore). Users verify:
```bash
npm audit signatures
```

**curl (everyone else):**
```bash
curl -fsSL handprint.sh/install | sh
```

The installer:
1. Detects OS and architecture
2. Downloads the release tarball from GitHub Releases
3. Downloads the SHA-256 manifest (Sigstore-signed)
4. Verifies the tarball hash against the signed manifest
5. Extracts to `~/.handprint/bin/`
6. Adds to PATH (or prints instructions)

### Release Signing

Every release is signed two ways:

1. **npm provenance** — automatic via GitHub Actions with `--provenance` flag. Generates SLSA Build Level 3 attestation signed by Sigstore. Verifiable: `npm audit signatures`.

2. **GitHub Release checksums** — SHA-256 manifest (`checksums.txt`) signed by the project's Sigstore identity. The curl installer verifies against this.

Both use Sigstore (keyless signing via OIDC) — no GPG keys to manage or rotate.

## Cryptographic Architecture

### Design Principles

1. **One seed, everything derived.** All key material comes from a single 32-byte random seed.
2. **Post-quantum encryption today.** Payload encryption key is derived from the seed via HKDF, not from the Ed25519 keypair. Quantum-safe by construction.
3. **Signing is PQ-migratable.** Ed25519 now (`v: 1`). Hybrid Ed25519 + ML-DSA when libsodium ships it (`v: 2`).
4. **libsodium everywhere.** One audited library, no custom crypto. Constant-time operations, secure memory wiping.
5. **Compact keys.** 32-byte keys, base64url encoding. No PEM, no ASN.1.

### Key Hierarchy

```
seed (32 bytes, random, stored at ~/.handprint/keys/seed)
│
├── Ed25519 keypair
│   ├── Private key: crypto_sign_seed_keypair(seed) → sk (64 bytes)
│   ├── Public key: extracted from keypair → pk (32 bytes)
│   └── Fingerprint: base64url(sha256(pk))[0:16]
│
└── Encryption key
    └── HKDF-SHA256(ikm=seed, salt="handprint", info="payload-encryption-v1") → 32 bytes
```

### Why This Is Quantum-Safe for Encryption

```
Quantum computer + public key → Ed25519 private scalar (Shor's algorithm)
Quantum computer + public key → seed? NO. SHA-512 is one-way, quantum-resistant.
Quantum computer + public key → encryption key? NO. Derived from seed, not from scalar.
```

The encryption key is hidden behind two one-way functions (SHA-512 inside Ed25519 key derivation, then HKDF). Even with a quantum computer, the only path to the encryption key is through the seed — and the seed cannot be recovered from the public key.

### Signature Scheme (Versioned)

**v1 (current):** Ed25519 only.

```
1. Canonical JSON: sorted keys, no whitespace, deterministic
2. Digest: SHA-256(canonical_json)
3. Signature: crypto_sign_detached(digest, ed25519_sk) → 64 bytes
4. Encode: base64url(signature), base64url(pubkey)
```

**v2 (future, when libsodium ships ML-DSA):** Hybrid Ed25519 + ML-DSA.

```
sig_v2 = {
  ed25519: base64url(Ed25519_sign(digest)),
  mldsa: base64url(MLDSA_sign(digest)),
}
```

Both signatures must verify. If one algorithm is broken, the other still proves authorship.

Migration: `handprint keys migrate --to v2` re-derives ML-DSA keypair from seed, registers new composite public key with hub.

### Encryption Scheme

**Algorithm:** XSalsa20-Poly1305 via `crypto_secretbox` (libsodium).

```
1. Derive key: HKDF-SHA256(seed, "handprint", "payload-encryption-v1") → 32 bytes
2. Generate nonce: 24 random bytes (XSalsa20 nonce space is large enough for random)
3. Encrypt: crypto_secretbox_easy(sanitized_plaintext, nonce, derived_key)
4. Store: base64url(nonce || ciphertext)
```

Properties:
- 256-bit key (quantum-resistant)
- 24-byte nonce (no collision risk with random generation)
- Authenticated encryption (Poly1305 MAC)
- Never reuse nonces (random from 2^192 space)

### Key Storage

```
~/.handprint/
├── keys/
│   └── seed              # 32 bytes, base64url, mode 0600
├── config.json           # identity, hub URL
└── credentials.json      # hub auth token, encrypted with derived key
```

**Permissions:**
- `~/.handprint/keys/` — directory mode `0700`
- `~/.handprint/keys/seed` — file mode `0600`
- CLI warns on init and every run if permissions are looser than expected

**Secure memory:**
- `sodium.memzero()` on all key buffers after use
- Never log, print, or serialize the seed or derived keys
- Never include key material in error messages

### Key Generation (`handprint init`)

```typescript
import sodium from 'libsodium-wrappers';

await sodium.ready;

// Generate seed
const seed = sodium.randombytes_buf(32);

// Derive Ed25519 keypair
const { publicKey, privateKey } = sodium.crypto_sign_seed_keypair(seed);

// Derive encryption key (quantum-safe)
const encKey = sodium.crypto_generichash(32,
  sodium.from_string("payload-encryption-v1"),
  seed
);

// Fingerprint
const fingerprint = base64url(sodium.crypto_generichash(32, publicKey)).slice(0, 16);

// Store seed only (everything else re-derived on load)
writeFileSync(seedPath, base64url(seed), { mode: 0o600 });

// Wipe sensitive buffers
sodium.memzero(seed);
sodium.memzero(privateKey);
sodium.memzero(encKey);
```

On every CLI invocation, the seed is read, keys are derived in memory, used, and wiped. Only the seed persists on disk.

## Multi-Device Key Management

### Registration

Each device has its own seed → own Ed25519 public key. Users register keys with the hub:

```bash
handprint keys add --label "MacBook Pro"
# → registers pubkey + fingerprint + label with hub API
```

The hub stores per-user:
```json
{
  "publicKeys": [
    { "pubkey": "base64url...", "fingerprint": "abc123def456", "label": "MacBook Pro", "addedAt": "2026-06-26T..." },
    { "pubkey": "base64url...", "fingerprint": "xyz789uvw012", "label": "Work Desktop", "addedAt": "2026-06-27T..." }
  ]
}
```

### Verification

When verifying a handprint, the hub checks the `pubkey` field against ALL registered keys for that user. Any match = valid.

### Key Rotation

```bash
handprint keys rotate
# 1. Generate new seed
# 2. Register new public key with hub
# 3. Mark old public key as retired (with timestamp)
# 4. Old handprints remain verifiable (old pubkey still stored, marked retired)
# 5. Optionally re-encrypt local payloads with new encryption key
```

### Key Revocation

```bash
handprint keys revoke <fingerprint>
# Marks a key as compromised on the hub
# Handprints signed with revoked keys show a warning on verification
# Does NOT delete old handprints — provenance is permanent
```

## Privacy Guarantees

### What NEVER Leaves the Machine

| Data | Where it lives | Who can access |
|------|---------------|----------------|
| Seed (private key material) | `~/.handprint/keys/seed` | Owner only (mode 0600) |
| Encryption key (derived) | In memory only | Owner only (wiped after use) |
| Raw conversation text | Never stored (sanitized first) | Nobody |
| Sanitized conversation | `.handprint/objects/` (encrypted) | Owner only (via seed) |
| Hub auth tokens | `~/.handprint/credentials.json` (encrypted) | Owner only |

### What Gets Published to the Hub

| Data | Purpose |
|------|---------|
| Marks (type, subtype, note) | Decision substance — the whole point |
| Artifacts (type, uri, hash) | Output references |
| Source (agent, extractor, session) | Interaction context |
| Timestamps | Temporal ordering |
| Signature + public key | Cryptographic proof of authorship |
| Chain parent hash | Provenance chain integrity |

### Sanitization Pipeline

Before encryption, user input passes through aggressive sanitization:

1. Email addresses → `[REDACTED_EMAIL]`
2. API keys / secrets (ALL_CAPS patterns) → `[REDACTED_KEY]`
3. URL auth tokens (query params) → `[REDACTED_TOKEN]`
4. High-entropy strings (8+ chars, mixed alphanumeric) → `[REDACTED_TOKEN]`
5. File paths with usernames → `[REDACTED_PATH]`

False positives are acceptable — over-redaction is safer than under-redaction.

### Per-Project Visibility

Set in `.handprint/config.json`:

| Level | Local storage | Hub push | Hub indexing |
|-------|-------------|----------|-------------|
| `private` | Yes | No | No |
| `unlisted` | Yes | Yes | No (direct link only) |
| `public` | Yes | Yes | Yes (profile, search) |

Default: `private`. Users explicitly opt in to publishing.

## Installation Verification

### npm Install Verification

npm provenance is automatic when publishing from GitHub Actions with `--provenance`. Users verify:

```bash
npm audit signatures
# Verifies Sigstore attestation for every installed package
# Confirms: built from this source repo, by this CI, at this commit
```

### curl Install Verification

The install script at `handprint.sh/install`:

```bash
#!/bin/sh
set -euo pipefail

VERSION="${1:-latest}"
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

# Normalize arch
case "$ARCH" in
  x86_64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
esac

TARBALL="handprint-${VERSION}-${OS}-${ARCH}.tar.gz"
CHECKSUMS="checksums-${VERSION}.txt"
BASE_URL="https://github.com/CameronWhiteside/handprint/releases/download/v${VERSION}"

# Download tarball and checksums
curl -fsSL "${BASE_URL}/${TARBALL}" -o "/tmp/${TARBALL}"
curl -fsSL "${BASE_URL}/${CHECKSUMS}" -o "/tmp/${CHECKSUMS}"

# Verify SHA-256
EXPECTED=$(grep "${TARBALL}" "/tmp/${CHECKSUMS}" | cut -d' ' -f1)
ACTUAL=$(shasum -a 256 "/tmp/${TARBALL}" | cut -d' ' -f1)

if [ "$EXPECTED" != "$ACTUAL" ]; then
  echo "ERROR: SHA-256 mismatch. Installation aborted."
  echo "Expected: $EXPECTED"
  echo "Actual:   $ACTUAL"
  rm -f "/tmp/${TARBALL}" "/tmp/${CHECKSUMS}"
  exit 1
fi

# Extract
mkdir -p "${HOME}/.handprint/bin"
tar -xzf "/tmp/${TARBALL}" -C "${HOME}/.handprint/bin"
rm -f "/tmp/${TARBALL}" "/tmp/${CHECKSUMS}"

echo "handprint installed to ~/.handprint/bin/handprint"
echo "Add to PATH: export PATH=\"\$HOME/.handprint/bin:\$PATH\""
```

### Build Reproducibility

GitHub Actions workflow publishes with:
- Pinned Node.js version
- Lockfile-only installs (`npm ci`)
- `--provenance` flag (SLSA attestation)
- Checksum generation + Sigstore signing in the same workflow

## CLI Commands (Updated)

```
handprint init [--global]        # Generate seed + keys, create .handprint/
handprint login                  # Device auth flow → encrypted credentials
handprint grab                   # Scan transcripts, extract marks, sign, store
handprint push                   # Publish to hub (respects visibility)
handprint status                 # Chain state, unpushed count, key fingerprint
handprint log                    # List local handprints
handprint show <ref>             # Display by hash, optional --decrypt
handprint verify                 # Validate chain integrity + signatures
handprint keys list              # Show registered public keys
handprint keys add --label "..."  # Register current device's key with hub
handprint keys rotate            # Generate new seed, register, retire old
handprint keys revoke <fp>       # Mark a key as compromised
handprint keys export            # Export seed (for backup) — requires confirmation
handprint config show|get|set    # Manage config
```

## Dependencies

| Package | Purpose | Size |
|---------|---------|------|
| `libsodium-wrappers` | All cryptography | ~200KB (wasm) |
| `commander` | CLI framework | ~50KB |
| `@handprint-sh/types` | Zod schemas | ~30KB |
| `zod` | Schema validation | ~60KB |

Total: ~340KB. No native compilation. Works on any platform with Node.js 20+.

## What This Design Does NOT Cover

- AI extraction prompts and extractor model selection — separate concern
- Hub site UI — separate spec
- AGENTS.md content and skill packages — separate spec
- Specific transcript source adapters (Cursor, Codex, etc.) — plugins
- C2PA manifest embedding — future extension
