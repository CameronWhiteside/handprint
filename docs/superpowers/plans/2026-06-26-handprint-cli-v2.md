# Handprint CLI v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the handprint CLI from the v1 seal+meta model to the v2 9-field handprint object model with libsodium crypto, two-tier directory structure, and hub API integration.

**Architecture:** Replace Node.js crypto with libsodium-wrappers (single 32-byte seed derives Ed25519 keypair + BLAKE2b encryption key). Split init into global (`~/.handprint/`) and per-project (`.handprint/`). Replace Cloudflare KV push with hub API POST. Unify seal+meta into a single handprint object with marks, artifacts, and source.

**Tech Stack:** TypeScript, libsodium-wrappers (WASM), commander, vitest, @handprint-sh/types (Zod schemas)

## Global Constraints

- Package name: `handprint-sh` (npm). Binary: `handprint`.
- Types package: `@handprint-sh/types` (workspace at `packages/types/`).
- All types from `@handprint-sh/types` — never duplicate Zod schemas in CLI code.
- Node.js 20+ required.
- Never raw SQL. Drizzle ORM for API (not relevant to CLI).
- `libsodium-wrappers` for ALL cryptography. No `node:crypto`.
- Base64url encoding for all keys, signatures, fingerprints. No PEM, no hex.
- File permissions: seed file `0600`, keys directory `0700`.
- Test runner: `vitest` (already configured).
- Existing tests in `tests/` mirror `src/` structure.

---

## File Map

### Create
| File | Purpose |
|------|---------|
| `src/crypto/sodium.ts` | libsodium wrapper: seed generation, key derivation, sign, verify, encrypt, decrypt |
| `src/dirs/global.ts` | `~/.handprint/` operations: init, load/save global config, load seed |
| `src/dirs/project.ts` | `.handprint/` operations: init, load/save project config, AGENTS.md |
| `src/hub/client.ts` | Hub API client: push handprint, register key, device auth |
| `src/commands/login.ts` | Device auth flow for hub |
| `src/commands/keys.ts` | Key management: add, list, rotate, revoke, export |
| `src/commands/status.ts` | Chain state, unpushed count, key fingerprint |
| `tests/crypto/sodium.test.ts` | Full crypto test suite |
| `tests/dirs/global.test.ts` | Global dir tests |
| `tests/dirs/project.test.ts` | Project dir tests |
| `tests/hub/client.test.ts` | Hub client tests (mocked fetch) |
| `tests/commands/status.test.ts` | Status command tests |
| `tests/commands/keys.test.ts` | Key management tests |

### Modify
| File | Change |
|------|--------|
| `package.json` | Rename to `handprint-sh`, add `libsodium-wrappers`, remove `@anthropic-ai/sdk` |
| `src/store/hash.ts` | Use libsodium `crypto_generichash` for SHA-256 → keep BLAKE2b for consistency |
| `src/store/objects.ts` | No changes needed (generic object store) |
| `src/store/refs.ts` | No changes needed |
| `src/sanitizer/sanitize.ts` | No changes needed |
| `src/scanner/ai-extractor.ts` | Update extraction prompt to output marks schema, update to use source model |
| `src/scanner/claude-code.ts` | No changes needed (transcript parser) |
| `src/commands/init.ts` | Two-tier: `--global` flag, delegate to dirs/global + dirs/project |
| `src/commands/grab.ts` | Build handprint objects instead of seal+meta |
| `src/commands/push.ts` | Hub API POST instead of Cloudflare KV |
| `src/commands/verify.ts` | New signature format (base64url, libsodium verify) |
| `src/commands/log.ts` | List handprint objects, no more meta |
| `src/commands/show.ts` | Show handprint objects with optional decrypt |
| `src/commands/config.ts` | Support global + project config paths |
| `src/index.ts` | Updated exports |
| `bin/handprint.ts` | New commands (keys, login, status), updated commands, remove seal/scan/profile |

### Delete
| File | Reason |
|------|--------|
| `src/model/handprint.ts` | Replaced by `@handprint-sh/types` |
| `src/model/meta.ts` | No more separate DecisionMeta — marks are inline |
| `src/model/seal.ts` | No more Seal interface — unified handprint object |
| `src/model/resolution.ts` | Removed from v2 core |
| `src/store/meta.ts` | No more meta store |
| `src/profile/types.ts` | Replaced by `@handprint-sh/types` profile schemas |
| `src/profile/anchors.ts` | Anchors → artifacts |
| `src/profile/compute.ts` | Profile computation moves to hub |
| `src/commands/seal.ts` | Sealing logic folded into grab |
| `src/commands/scan.ts` | Heuristic scanner removed; AI extractor is the path |
| `src/commands/export.ts` | Removed; `handprint log --json` suffices |
| `src/crypto/keys.ts` | Replaced by `src/crypto/sodium.ts` |
| `tests/model/*` | Old model tests |
| `tests/store/meta.test.ts` | Meta store gone |
| `tests/profile/*` | Old profile tests |
| `tests/commands/seal.test.ts` | Seal command gone |
| `tests/commands/export.test.ts` | Export command gone |
| `tests/scanner/git.test.ts` | Git scanner removed |
| `tests/crypto/keys.test.ts` | Replaced by sodium tests |
| `src/scanner/git.ts` | Git heuristic scanner removed |

---

### Task 1: Package Setup + libsodium Crypto Module

**Files:**
- Modify: `package.json`
- Create: `src/crypto/sodium.ts`
- Create: `tests/crypto/sodium.test.ts`
- Delete: `src/crypto/keys.ts`
- Delete: `tests/crypto/keys.test.ts`

**Interfaces:**
- Consumes: nothing (foundational)
- Produces:
  - `generateSeed(): Promise<Uint8Array>` — 32 random bytes
  - `deriveKeypair(seed: Uint8Array): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>` — Ed25519 from seed
  - `deriveEncryptionKey(seed: Uint8Array): Promise<Uint8Array>` — BLAKE2b keyed hash
  - `fingerprint(publicKey: Uint8Array): string` — base64url(sha256(pk))[0:16]
  - `signDetached(message: Uint8Array, privateKey: Uint8Array): Promise<Uint8Array>` — Ed25519
  - `verifyDetached(signature: Uint8Array, message: Uint8Array, publicKey: Uint8Array): Promise<boolean>`
  - `encrypt(plaintext: string, key: Uint8Array): Promise<string>` — XSalsa20-Poly1305, returns base64url(nonce||ciphertext)
  - `decrypt(packed: string, key: Uint8Array): Promise<string>` — reverses encrypt
  - `toBase64url(bytes: Uint8Array): string`
  - `fromBase64url(str: string): Uint8Array`
  - `ensureSodium(): Promise<void>` — ensures `sodium.ready` has resolved

- [ ] **Step 1: Update package.json**

```json
{
  "name": "handprint-sh",
  "version": "0.2.0",
  "type": "module",
  "workspaces": ["packages/*"],
  "bin": {
    "handprint": "./bin/handprint.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "handprint": "tsx bin/handprint.ts"
  },
  "description": "Human decision provenance for the age of AI",
  "dependencies": {
    "commander": "^14.0.3",
    "libsodium-wrappers": "^0.7.15"
  },
  "devDependencies": {
    "@types/node": "^25.9.2",
    "tsx": "^4.22.4",
    "typescript": "^6.0.3",
    "vitest": "^4.1.8"
  }
}
```

Remove `@anthropic-ai/sdk` (extraction will use configurable model, not hardcoded Anthropic). Add `libsodium-wrappers`.

- [ ] **Step 2: Install dependencies**

Run: `cd ~/handprint && npm install`
Expected: lockfile updates, `libsodium-wrappers` installed

- [ ] **Step 3: Write the failing crypto tests**

Create `tests/crypto/sodium.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  ensureSodium,
  generateSeed,
  deriveKeypair,
  deriveEncryptionKey,
  fingerprint,
  signDetached,
  verifyDetached,
  encrypt,
  decrypt,
  toBase64url,
  fromBase64url,
} from '../../src/crypto/sodium.js';

describe('sodium crypto', () => {
  it('generateSeed returns 32 bytes', async () => {
    await ensureSodium();
    const seed = await generateSeed();
    expect(seed).toBeInstanceOf(Uint8Array);
    expect(seed.length).toBe(32);
  });

  it('generateSeed returns unique seeds', async () => {
    const a = await generateSeed();
    const b = await generateSeed();
    expect(toBase64url(a)).not.toBe(toBase64url(b));
  });

  it('deriveKeypair returns 32-byte public + 64-byte private', async () => {
    const seed = await generateSeed();
    const kp = await deriveKeypair(seed);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.privateKey.length).toBe(64);
  });

  it('deriveKeypair is deterministic from same seed', async () => {
    const seed = await generateSeed();
    const kp1 = await deriveKeypair(seed);
    const kp2 = await deriveKeypair(seed);
    expect(toBase64url(kp1.publicKey)).toBe(toBase64url(kp2.publicKey));
    expect(toBase64url(kp1.privateKey)).toBe(toBase64url(kp2.privateKey));
  });

  it('deriveEncryptionKey returns 32 bytes from seed', async () => {
    const seed = await generateSeed();
    const key = await deriveEncryptionKey(seed);
    expect(key).toBeInstanceOf(Uint8Array);
    expect(key.length).toBe(32);
  });

  it('deriveEncryptionKey is deterministic', async () => {
    const seed = await generateSeed();
    const k1 = await deriveEncryptionKey(seed);
    const k2 = await deriveEncryptionKey(seed);
    expect(toBase64url(k1)).toBe(toBase64url(k2));
  });

  it('deriveEncryptionKey differs from signing key', async () => {
    const seed = await generateSeed();
    const encKey = await deriveEncryptionKey(seed);
    const kp = await deriveKeypair(seed);
    expect(toBase64url(encKey)).not.toBe(toBase64url(kp.privateKey.slice(0, 32)));
  });

  it('fingerprint returns 16-char string', async () => {
    const seed = await generateSeed();
    const kp = await deriveKeypair(seed);
    const fp = fingerprint(kp.publicKey);
    expect(typeof fp).toBe('string');
    expect(fp.length).toBe(16);
  });

  it('sign and verify round-trip', async () => {
    const seed = await generateSeed();
    const kp = await deriveKeypair(seed);
    const message = new TextEncoder().encode('hello world');
    const sig = await signDetached(message, kp.privateKey);
    expect(sig.length).toBe(64);
    const valid = await verifyDetached(sig, message, kp.publicKey);
    expect(valid).toBe(true);
  });

  it('verify rejects tampered message', async () => {
    const seed = await generateSeed();
    const kp = await deriveKeypair(seed);
    const message = new TextEncoder().encode('hello world');
    const sig = await signDetached(message, kp.privateKey);
    const tampered = new TextEncoder().encode('hello worl!');
    const valid = await verifyDetached(sig, tampered, kp.publicKey);
    expect(valid).toBe(false);
  });

  it('verify rejects wrong public key', async () => {
    const seed1 = await generateSeed();
    const seed2 = await generateSeed();
    const kp1 = await deriveKeypair(seed1);
    const kp2 = await deriveKeypair(seed2);
    const message = new TextEncoder().encode('hello');
    const sig = await signDetached(message, kp1.privateKey);
    const valid = await verifyDetached(sig, message, kp2.publicKey);
    expect(valid).toBe(false);
  });

  it('encrypt and decrypt round-trip', async () => {
    const seed = await generateSeed();
    const key = await deriveEncryptionKey(seed);
    const plaintext = 'secret conversation text';
    const packed = await encrypt(plaintext, key);
    expect(typeof packed).toBe('string');
    expect(packed).not.toContain(plaintext);
    const decrypted = await decrypt(packed, key);
    expect(decrypted).toBe(plaintext);
  });

  it('encrypt produces different ciphertext each time (random nonce)', async () => {
    const seed = await generateSeed();
    const key = await deriveEncryptionKey(seed);
    const plaintext = 'same text twice';
    const a = await encrypt(plaintext, key);
    const b = await encrypt(plaintext, key);
    expect(a).not.toBe(b);
  });

  it('decrypt fails with wrong key', async () => {
    const seed1 = await generateSeed();
    const seed2 = await generateSeed();
    const key1 = await deriveEncryptionKey(seed1);
    const key2 = await deriveEncryptionKey(seed2);
    const packed = await encrypt('secret', key1);
    await expect(decrypt(packed, key2)).rejects.toThrow();
  });

  it('base64url round-trip', () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 254, 253]);
    const encoded = toBase64url(bytes);
    expect(encoded).not.toContain('+');
    expect(encoded).not.toContain('/');
    expect(encoded).not.toContain('=');
    const decoded = fromBase64url(encoded);
    expect(decoded).toEqual(bytes);
  });

  it('encrypt handles empty string', async () => {
    const seed = await generateSeed();
    const key = await deriveEncryptionKey(seed);
    const packed = await encrypt('', key);
    const decrypted = await decrypt(packed, key);
    expect(decrypted).toBe('');
  });

  it('encrypt handles unicode', async () => {
    const seed = await generateSeed();
    const key = await deriveEncryptionKey(seed);
    const text = '日本語テスト 🎨';
    const packed = await encrypt(text, key);
    const decrypted = await decrypt(packed, key);
    expect(decrypted).toBe(text);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd ~/handprint && npx vitest run tests/crypto/sodium.test.ts`
Expected: FAIL — module `../../src/crypto/sodium.js` not found

- [ ] **Step 5: Implement the crypto module**

Create `src/crypto/sodium.ts`:

```typescript
import sodium from 'libsodium-wrappers';

const ENCRYPTION_CONTEXT = 'payload-encryption-v1';

let ready = false;

export async function ensureSodium(): Promise<void> {
  if (ready) return;
  await sodium.ready;
  ready = true;
}

export async function generateSeed(): Promise<Uint8Array> {
  await ensureSodium();
  return sodium.randombytes_buf(32);
}

export async function deriveKeypair(seed: Uint8Array): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  await ensureSodium();
  const kp = sodium.crypto_sign_seed_keypair(seed);
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

export async function deriveEncryptionKey(seed: Uint8Array): Promise<Uint8Array> {
  await ensureSodium();
  return sodium.crypto_generichash(
    32,
    sodium.from_string(ENCRYPTION_CONTEXT),
    seed,
  );
}

export function fingerprint(publicKey: Uint8Array): string {
  const hash = sodium.crypto_generichash(32, publicKey);
  return toBase64url(hash).slice(0, 16);
}

export async function signDetached(
  message: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  await ensureSodium();
  return sodium.crypto_sign_detached(message, privateKey);
}

export async function verifyDetached(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  await ensureSodium();
  try {
    return sodium.crypto_sign_verify_detached(signature, message, publicKey);
  } catch {
    return false;
  }
}

export async function encrypt(plaintext: string, key: Uint8Array): Promise<string> {
  await ensureSodium();
  const nonce = sodium.randombytes_buf(sodium.crypto_secretbox_NONCEBYTES);
  const messageBytes = sodium.from_string(plaintext);
  const ciphertext = sodium.crypto_secretbox_easy(messageBytes, nonce, key);
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce);
  packed.set(ciphertext, nonce.length);
  return toBase64url(packed);
}

export async function decrypt(packed: string, key: Uint8Array): Promise<string> {
  await ensureSodium();
  const bytes = fromBase64url(packed);
  const nonceLen = sodium.crypto_secretbox_NONCEBYTES;
  const nonce = bytes.slice(0, nonceLen);
  const ciphertext = bytes.slice(nonceLen);
  const decrypted = sodium.crypto_secretbox_open_easy(ciphertext, nonce, key);
  return sodium.to_string(decrypted);
}

export function toBase64url(bytes: Uint8Array): string {
  const b64 = sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
  return b64;
}

export function fromBase64url(str: string): Uint8Array {
  return sodium.from_base64(str, sodium.base64_variants.URLSAFE_NO_PADDING);
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd ~/handprint && npx vitest run tests/crypto/sodium.test.ts`
Expected: All 16 tests PASS

- [ ] **Step 7: Delete old crypto module**

```bash
rm src/crypto/keys.ts tests/crypto/keys.test.ts
```

- [ ] **Step 8: Commit**

```bash
git add src/crypto/sodium.ts tests/crypto/sodium.test.ts package.json package-lock.json
git add -u src/crypto/keys.ts tests/crypto/keys.test.ts
git commit -m "feat: replace node:crypto with libsodium, rename to handprint-sh"
```

---

### Task 2: Canonicalize + Hash Module

**Files:**
- Modify: `src/store/hash.ts`
- Modify: `tests/store/hash.test.ts`

**Interfaces:**
- Consumes: `ensureSodium()`, `toBase64url()` from `src/crypto/sodium.ts`
- Produces:
  - `canonicalize(value: unknown): string` — deterministic JSON (sorted keys, no whitespace)
  - `hashObject(obj: Record<string, unknown>): Promise<string>` — SHA-256 hex of canonical JSON (now async)
  - `sha256(data: Uint8Array): Uint8Array` — raw SHA-256 via libsodium

Note: `hashObject` becomes async because it needs `ensureSodium()`. All callers will be updated in later tasks.

- [ ] **Step 1: Update the hash test**

Replace `tests/store/hash.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hashObject, canonicalize, sha256 } from '../../src/store/hash.js';
import { ensureSodium } from '../../src/crypto/sodium.js';

describe('canonicalize', () => {
  it('sorts object keys', () => {
    const result = canonicalize({ b: 1, a: 2 });
    expect(result).toBe('{"a":2,"b":1}');
  });

  it('sorts nested object keys', () => {
    const result = canonicalize({ z: { b: 1, a: 2 }, a: 3 });
    expect(result).toBe('{"a":3,"z":{"a":2,"b":1}}');
  });

  it('handles arrays (no sorting)', () => {
    const result = canonicalize([3, 1, 2]);
    expect(result).toBe('[3,1,2]');
  });

  it('handles null', () => {
    expect(canonicalize(null)).toBe('null');
  });

  it('handles strings', () => {
    expect(canonicalize('hello')).toBe('"hello"');
  });

  it('handles booleans', () => {
    expect(canonicalize(true)).toBe('true');
  });
});

describe('hashObject', () => {
  it('returns 64-char hex string', async () => {
    await ensureSodium();
    const hash = await hashObject({ a: 1 });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('is deterministic', async () => {
    const h1 = await hashObject({ x: 1, y: 2 });
    const h2 = await hashObject({ y: 2, x: 1 });
    expect(h1).toBe(h2);
  });

  it('differs for different objects', async () => {
    const h1 = await hashObject({ a: 1 });
    const h2 = await hashObject({ a: 2 });
    expect(h1).not.toBe(h2);
  });
});

describe('sha256', () => {
  it('returns 32 bytes', async () => {
    await ensureSodium();
    const hash = sha256(new TextEncoder().encode('test'));
    expect(hash.length).toBe(32);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/handprint && npx vitest run tests/store/hash.test.ts`
Expected: FAIL — `sha256` not exported, `hashObject` not async

- [ ] **Step 3: Update the hash module**

Replace `src/store/hash.ts`:

```typescript
import sodium from 'libsodium-wrappers';
import { ensureSodium } from '../crypto/sodium.js';

export function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return '[' + value.map(canonicalize).join(',') + ']';
  }

  const sorted = Object.keys(value as Record<string, unknown>).sort();
  const entries = sorted.map(
    (key) =>
      JSON.stringify(key) +
      ':' +
      canonicalize((value as Record<string, unknown>)[key]),
  );
  return '{' + entries.join(',') + '}';
}

export function sha256(data: Uint8Array): Uint8Array {
  return sodium.crypto_hash_sha256(data);
}

export async function hashObject(obj: Record<string, unknown>): Promise<string> {
  await ensureSodium();
  const canonical = canonicalize(obj);
  const hash = sha256(new TextEncoder().encode(canonical));
  return sodium.to_hex(hash);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd ~/handprint && npx vitest run tests/store/hash.test.ts`
Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/hash.ts tests/store/hash.test.ts
git commit -m "feat: migrate hash module to libsodium SHA-256"
```

---

### Task 3: Two-Tier Directory Structure

**Files:**
- Create: `src/dirs/global.ts`
- Create: `src/dirs/project.ts`
- Create: `tests/dirs/global.test.ts`
- Create: `tests/dirs/project.test.ts`
- Delete: `src/commands/init.ts` (replaced by dirs modules)
- Delete: `tests/commands/init.test.ts`

**Interfaces:**
- Consumes:
  - `generateSeed()`, `deriveKeypair()`, `fingerprint()`, `toBase64url()`, `fromBase64url()`, `ensureSodium()` from `src/crypto/sodium.ts`
  - `GlobalConfig`, `ProjectConfig`, `globalConfigSchema`, `projectConfigSchema` from `@handprint-sh/types`
- Produces:
  - `globalDir(): string` — returns `~/.handprint`
  - `initGlobal(identity: { handle: string; name: string; email: string }, hubUrl?: string): Promise<string>` — creates `~/.handprint/` with seed, config; returns path
  - `loadGlobalConfig(): GlobalConfig` — reads `~/.handprint/config.json`
  - `saveGlobalConfig(config: GlobalConfig): void`
  - `loadSeed(): Uint8Array` — reads `~/.handprint/keys/seed`
  - `isGlobalInitialized(): boolean`
  - `projectDir(cwd?: string): string` — returns `<cwd>/.handprint`
  - `initProject(cwd: string, visibility?: Visibility): string` — creates `.handprint/` with config, AGENTS.md, .gitignore
  - `loadProjectConfig(cwd: string): ProjectConfig`
  - `saveProjectConfig(cwd: string, config: ProjectConfig): void`
  - `isProjectInitialized(cwd?: string): boolean`
  - `findProjectRoot(startDir?: string): string | null` — walk up to find `.handprint/`

- [ ] **Step 1: Write failing global dir tests**

Create `tests/dirs/global.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, statSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `handprint-test-global-${Date.now()}`);

describe('global dir', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('initGlobal creates directory structure', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const path = await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(existsSync(join(path, 'keys', 'seed'))).toBe(true);
    expect(existsSync(join(path, 'config.json'))).toBe(true);
    expect(existsSync(join(path, 'sources'))).toBe(true);
  });

  it('seed file has mode 0600', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const path = await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const stat = statSync(join(path, 'keys', 'seed'));
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it('keys directory has mode 0700', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const path = await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const stat = statSync(join(path, 'keys'));
    expect(stat.mode & 0o777).toBe(0o700);
  });

  it('config.json contains identity', async () => {
    const { initGlobal, loadGlobalConfig } = await import('../../src/dirs/global.js');
    await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const config = loadGlobalConfig();
    expect(config.identity.handle).toBe('testuser');
    expect(config.identity.name).toBe('Test User');
    expect(config.identity.email).toBe('test@example.com');
    expect(config.hub.url).toBe('https://api.handprint.sh');
  });

  it('loadSeed returns 32 bytes that re-derive same keypair', async () => {
    const { initGlobal, loadSeed } = await import('../../src/dirs/global.js');
    const { deriveKeypair, toBase64url } = await import('../../src/crypto/sodium.js');
    await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    const seed = loadSeed();
    expect(seed.length).toBe(32);
    const kp = await deriveKeypair(seed);
    expect(kp.publicKey.length).toBe(32);
  });

  it('isGlobalInitialized returns false when not initialized', async () => {
    const { isGlobalInitialized } = await import('../../src/dirs/global.js');
    expect(isGlobalInitialized()).toBe(false);
  });

  it('isGlobalInitialized returns true after init', async () => {
    const { initGlobal, isGlobalInitialized } = await import('../../src/dirs/global.js');
    await initGlobal({
      handle: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
    });
    expect(isGlobalInitialized()).toBe(true);
  });

  it('initGlobal throws if already initialized', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const identity = { handle: 'testuser', name: 'Test User', email: 'test@example.com' };
    await initGlobal(identity);
    await expect(initGlobal(identity)).rejects.toThrow('already initialized');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/handprint && npx vitest run tests/dirs/global.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement global dir module**

Create `src/dirs/global.ts`:

```typescript
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { GlobalConfig } from '@handprint-sh/types';
import {
  generateSeed,
  toBase64url,
  fromBase64url,
} from '../crypto/sodium.js';

export function globalDir(): string {
  return process.env.HANDPRINT_HOME ?? join(homedir(), '.handprint');
}

export function isGlobalInitialized(): boolean {
  const dir = globalDir();
  return existsSync(join(dir, 'keys', 'seed')) && existsSync(join(dir, 'config.json'));
}

export async function initGlobal(
  identity: { handle: string; name: string; email: string },
  hubUrl: string = 'https://api.handprint.sh',
): Promise<string> {
  const dir = globalDir();

  if (isGlobalInitialized()) {
    throw new Error('already initialized');
  }

  const keysDir = join(dir, 'keys');
  mkdirSync(keysDir, { recursive: true });
  chmodSync(keysDir, 0o700);

  mkdirSync(join(dir, 'sources'), { recursive: true });

  const seed = await generateSeed();
  const seedPath = join(keysDir, 'seed');
  writeFileSync(seedPath, toBase64url(seed), { mode: 0o600 });

  const config: GlobalConfig = {
    version: '1.0.0',
    createdAt: new Date().toISOString(),
    identity,
    hub: { url: hubUrl },
  };

  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2));

  return dir;
}

export function loadGlobalConfig(): GlobalConfig {
  const configPath = join(globalDir(), 'config.json');
  if (!existsSync(configPath)) {
    throw new Error('not initialized: run "handprint init --global" first');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveGlobalConfig(config: GlobalConfig): void {
  const configPath = join(globalDir(), 'config.json');
  writeFileSync(configPath, JSON.stringify(config, null, 2));
}

export function loadSeed(): Uint8Array {
  const seedPath = join(globalDir(), 'keys', 'seed');
  if (!existsSync(seedPath)) {
    throw new Error('no seed found: run "handprint init --global" first');
  }
  const encoded = readFileSync(seedPath, 'utf-8').trim();
  return fromBase64url(encoded);
}
```

- [ ] **Step 4: Run global dir tests**

Run: `cd ~/handprint && npx vitest run tests/dirs/global.test.ts`
Expected: All 8 tests PASS

- [ ] **Step 5: Write failing project dir tests**

Create `tests/dirs/project.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, readFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_DIR = join(tmpdir(), `handprint-test-project-${Date.now()}`);

describe('project dir', () => {
  beforeEach(() => {
    mkdirSync(TEST_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('initProject creates directory structure', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    const path = initProject(TEST_DIR);
    expect(existsSync(join(path, 'config.json'))).toBe(true);
    expect(existsSync(join(path, 'objects'))).toBe(true);
    expect(existsSync(join(path, 'refs'))).toBe(true);
    expect(existsSync(join(path, 'AGENTS.md'))).toBe(true);
    expect(existsSync(join(path, '.gitignore'))).toBe(true);
  });

  it('config.json defaults to private visibility', async () => {
    const { initProject, loadProjectConfig } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    const config = loadProjectConfig(TEST_DIR);
    expect(config.visibility).toBe('private');
  });

  it('initProject respects visibility param', async () => {
    const { initProject, loadProjectConfig } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR, 'public');
    const config = loadProjectConfig(TEST_DIR);
    expect(config.visibility).toBe('public');
  });

  it('AGENTS.md contains correct content', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    const path = initProject(TEST_DIR);
    const content = readFileSync(join(path, 'AGENTS.md'), 'utf-8');
    expect(content).toContain('handprint grab');
    expect(content).toContain('@handprint-sh/types');
  });

  it('.gitignore tracks config and AGENTS.md, ignores objects/refs/log', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    const path = initProject(TEST_DIR);
    const content = readFileSync(join(path, '.gitignore'), 'utf-8');
    expect(content).toContain('objects/');
    expect(content).toContain('refs/');
    expect(content).toContain('log');
    expect(content).toContain('!config.json');
    expect(content).toContain('!AGENTS.md');
  });

  it('initProject throws if already initialized', async () => {
    const { initProject } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    expect(() => initProject(TEST_DIR)).toThrow('already initialized');
  });

  it('isProjectInitialized returns false when not initialized', async () => {
    const { isProjectInitialized } = await import('../../src/dirs/project.js');
    expect(isProjectInitialized(TEST_DIR)).toBe(false);
  });

  it('isProjectInitialized returns true after init', async () => {
    const { initProject, isProjectInitialized } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    expect(isProjectInitialized(TEST_DIR)).toBe(true);
  });

  it('findProjectRoot walks up to find .handprint', async () => {
    const { initProject, findProjectRoot } = await import('../../src/dirs/project.js');
    initProject(TEST_DIR);
    const subdir = join(TEST_DIR, 'src', 'deep');
    mkdirSync(subdir, { recursive: true });
    expect(findProjectRoot(subdir)).toBe(TEST_DIR);
  });

  it('findProjectRoot returns null when not found', async () => {
    const { findProjectRoot } = await import('../../src/dirs/project.js');
    expect(findProjectRoot(TEST_DIR)).toBeNull();
  });
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `cd ~/handprint && npx vitest run tests/dirs/project.test.ts`
Expected: FAIL — module not found

- [ ] **Step 7: Implement project dir module**

Create `src/dirs/project.ts`:

```typescript
import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, dirname } from 'node:path';
import type { ProjectConfig, Visibility } from '@handprint-sh/types';

const HANDPRINT_DIR = '.handprint';

const AGENTS_MD = `# Handprint

Decision provenance. Run \`handprint grab\` after significant decisions.

- Types/schemas: \`@handprint-sh/types\` (npm)
- CLI: \`handprint --help\`
- Docs: handprint.sh/docs
`;

const GITIGNORE = `# Handprint — track config and AGENTS.md, ignore local state
*
!.gitignore
!config.json
!AGENTS.md
`;

export function projectDir(cwd: string = process.cwd()): string {
  return join(cwd, HANDPRINT_DIR);
}

export function isProjectInitialized(cwd: string = process.cwd()): boolean {
  return existsSync(join(projectDir(cwd), 'config.json'));
}

export function initProject(
  cwd: string,
  visibility: Visibility = 'private',
): string {
  const dir = projectDir(cwd);

  if (isProjectInitialized(cwd)) {
    throw new Error('already initialized');
  }

  mkdirSync(join(dir, 'objects'), { recursive: true });
  mkdirSync(join(dir, 'refs'), { recursive: true });

  const config: ProjectConfig = {
    version: '1.0.0',
    visibility,
    createdAt: new Date().toISOString(),
  };

  writeFileSync(join(dir, 'config.json'), JSON.stringify(config, null, 2));
  writeFileSync(join(dir, 'AGENTS.md'), AGENTS_MD);
  writeFileSync(join(dir, '.gitignore'), GITIGNORE);

  return dir;
}

export function loadProjectConfig(cwd: string = process.cwd()): ProjectConfig {
  const configPath = join(projectDir(cwd), 'config.json');
  if (!existsSync(configPath)) {
    throw new Error('not initialized: run "handprint init" first');
  }
  return JSON.parse(readFileSync(configPath, 'utf-8'));
}

export function saveProjectConfig(cwd: string, config: ProjectConfig): void {
  writeFileSync(
    join(projectDir(cwd), 'config.json'),
    JSON.stringify(config, null, 2),
  );
}

export function findProjectRoot(startDir: string = process.cwd()): string | null {
  let current = startDir;
  while (true) {
    if (existsSync(join(current, HANDPRINT_DIR, 'config.json'))) {
      return current;
    }
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}
```

- [ ] **Step 8: Run project dir tests**

Run: `cd ~/handprint && npx vitest run tests/dirs/project.test.ts`
Expected: All 10 tests PASS

- [ ] **Step 9: Delete old init + update init command**

Delete `src/commands/init.ts` and `tests/commands/init.test.ts`. Create new `src/commands/init.ts`:

```typescript
import { initGlobal, isGlobalInitialized } from '../dirs/global.js';
import { initProject, isProjectInitialized } from '../dirs/project.js';
import type { Visibility } from '@handprint-sh/types';

export { isGlobalInitialized, isProjectInitialized };

export async function init(
  cwd: string,
  options: { global?: boolean; visibility?: Visibility } = {},
): Promise<string> {
  if (options.global) {
    const { execSync } = await import('node:child_process');
    let handle = 'unknown';
    let name = 'Unknown';
    let email = '';
    try {
      name = execSync('git config user.name', { encoding: 'utf-8' }).trim();
      email = execSync('git config user.email', { encoding: 'utf-8' }).trim();
      handle = name.toLowerCase().replace(/\s+/g, '');
    } catch { /* use defaults */ }

    const path = await initGlobal({ handle, name, email });

    if (!isProjectInitialized(cwd)) {
      initProject(cwd, options.visibility);
    }

    return path;
  }

  if (!isGlobalInitialized()) {
    throw new Error('global config not found: run "handprint init --global" first');
  }

  return initProject(cwd, options.visibility);
}
```

- [ ] **Step 10: Commit**

```bash
git add src/dirs/global.ts src/dirs/project.ts src/commands/init.ts
git add tests/dirs/global.test.ts tests/dirs/project.test.ts
git add -u tests/commands/init.test.ts
git commit -m "feat: two-tier directory structure (global + per-project)"
```

---

### Task 4: Handprint Object Builder

**Files:**
- Create: `src/builder/handprint.ts`
- Create: `tests/builder/handprint.test.ts`
- Modify: `src/store/objects.ts` (make `writeObject` async)

**Interfaces:**
- Consumes:
  - `loadSeed()` from `src/dirs/global.ts`
  - `deriveKeypair()`, `deriveEncryptionKey()`, `signDetached()`, `encrypt()`, `toBase64url()`, `fingerprint()` from `src/crypto/sodium.ts`
  - `hashObject()`, `canonicalize()`, `sha256()` from `src/store/hash.ts`
  - `writeObject()` from `src/store/objects.ts`
  - `getRef()`, `setRef()` from `src/store/refs.ts`
  - `sanitize()` from `src/sanitizer/sanitize.ts`
  - `HandprintObject`, `Mark`, `Artifact`, `Source` from `@handprint-sh/types`
- Produces:
  - `buildHandprint(input: BuildInput): Promise<{ hash: string; handprint: HandprintObject }>` — sanitize, encrypt, sign, store, chain

```typescript
interface BuildInput {
  projectRoot: string;
  marks: Mark[];
  artifacts?: Artifact[];
  source: Source;
  plaintext: string;
}
```

- [ ] **Step 1: Make writeObject async**

`src/store/objects.ts` — `writeObject` needs `hashObject` which is now async:

```typescript
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { hashObject } from './hash.js';

function objectPath(storeDir: string, hash: string): string {
  const prefix = hash.slice(0, 2);
  const rest = hash.slice(2);
  return join(storeDir, 'objects', prefix, rest);
}

export async function writeObject(
  storeDir: string,
  obj: Record<string, unknown>,
): Promise<string> {
  const hash = await hashObject(obj);
  const filePath = objectPath(storeDir, hash);
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(obj), 'utf-8');
  return hash;
}

export function readObject(
  storeDir: string,
  hash: string,
): Record<string, unknown> | null {
  const filePath = objectPath(storeDir, hash);
  if (!existsSync(filePath)) return null;
  const raw = readFileSync(filePath, 'utf-8');
  return JSON.parse(raw) as Record<string, unknown>;
}

export function objectExists(storeDir: string, hash: string): boolean {
  return existsSync(objectPath(storeDir, hash));
}
```

- [ ] **Step 2: Write failing builder tests**

Create `tests/builder/handprint.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync, existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import type { Mark, Source } from '@handprint-sh/types';

const TEST_HOME = join(tmpdir(), `handprint-test-builder-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `handprint-test-project-builder-${Date.now()}`);

describe('handprint builder', () => {
  beforeEach(async () => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;

    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    await initGlobal({ handle: 'testuser', name: 'Test', email: 'test@test.com' });
    initProject(TEST_PROJECT);
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  const testMarks: Mark[] = [
    { type: 'choice', subtype: 'override', note: 'Use libsodium instead of node:crypto' },
  ];

  const testSource: Source = {
    agent: 'claude-code/opus-4-8',
    extractor: 'claude-haiku-4-5',
    session: 'abc123',
  };

  it('builds a valid handprint object', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'user said: use libsodium',
    });

    expect(result.hash).toMatch(/^[a-f0-9]{64}$/);
    expect(result.handprint.v).toBe(1);
    expect(result.handprint.marks).toEqual(testMarks);
    expect(result.handprint.source).toEqual(testSource);
    expect(result.handprint.parent).toBeNull();
    expect(result.handprint.sig.length).toBeGreaterThan(0);
    expect(result.handprint.pubkey.length).toBeGreaterThan(0);
  });

  it('payload is encrypted (not plaintext)', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'this is a secret conversation',
    });

    expect(result.handprint.payload).not.toContain('secret conversation');
  });

  it('chains handprints via parent', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');

    const first = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'first conversation',
    });

    const second = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'Ship v2' }],
      source: testSource,
      plaintext: 'second conversation',
    });

    expect(first.handprint.parent).toBeNull();
    expect(second.handprint.parent).toBe(first.hash);
  });

  it('stores object in .handprint/objects/', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'test',
    });

    const objectsDir = join(TEST_PROJECT, '.handprint', 'objects');
    const prefix = result.hash.slice(0, 2);
    expect(existsSync(join(objectsDir, prefix))).toBe(true);
  });

  it('sanitizes plaintext before encrypting', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { loadSeed } = await import('../../src/dirs/global.js');
    const { deriveEncryptionKey, decrypt } = await import('../../src/crypto/sodium.js');

    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'my email is user@example.com and key is SUPER_SECRET_API_KEY',
    });

    const seed = loadSeed();
    const encKey = await deriveEncryptionKey(seed);
    const decrypted = await decrypt(result.handprint.payload, encKey);
    expect(decrypted).toContain('[REDACTED_EMAIL]');
    expect(decrypted).toContain('[REDACTED_KEY]');
    expect(decrypted).not.toContain('user@example.com');
  });

  it('appends hash to log file', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { readFileSync } = await import('node:fs');

    const result = await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: testMarks,
      source: testSource,
      plaintext: 'test',
    });

    const logPath = join(TEST_PROJECT, '.handprint', 'log');
    const log = readFileSync(logPath, 'utf-8').trim();
    expect(log).toBe(result.hash);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd ~/handprint && npx vitest run tests/builder/handprint.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Implement the handprint builder**

Create `src/builder/handprint.ts`:

```typescript
import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HandprintObject, Mark, Artifact, Source } from '@handprint-sh/types';
import { HANDPRINT_OBJECT_VERSION } from '@handprint-sh/types';
import { loadSeed } from '../dirs/global.js';
import {
  deriveKeypair,
  deriveEncryptionKey,
  signDetached,
  encrypt,
  toBase64url,
  ensureSodium,
} from '../crypto/sodium.js';
import { canonicalize, sha256 } from '../store/hash.js';
import { writeObject } from '../store/objects.js';
import { getRef, setRef } from '../store/refs.js';
import { sanitize } from '../sanitizer/sanitize.js';
import { projectDir } from '../dirs/project.js';

export interface BuildInput {
  projectRoot: string;
  marks: Mark[];
  artifacts?: Artifact[];
  source: Source;
  plaintext: string;
}

export async function buildHandprint(input: BuildInput): Promise<{
  hash: string;
  handprint: HandprintObject;
}> {
  await ensureSodium();

  const hpDir = projectDir(input.projectRoot);
  if (!existsSync(hpDir)) {
    throw new Error('not initialized: run "handprint init" first');
  }

  const seed = loadSeed();
  const kp = await deriveKeypair(seed);
  const encKey = await deriveEncryptionKey(seed);

  const sanitized = sanitize(input.plaintext);
  const payload = await encrypt(sanitized, encKey);

  const currentHead = getRef(hpDir, 'HEAD');

  const unsigned: Omit<HandprintObject, 'sig'> = {
    v: HANDPRINT_OBJECT_VERSION,
    ts: new Date().toISOString(),
    marks: input.marks,
    artifacts: input.artifacts ?? [],
    source: input.source,
    payload,
    parent: currentHead,
    pubkey: toBase64url(kp.publicKey),
  };

  const canonical = canonicalize(unsigned as unknown as Record<string, unknown>);
  const digest = sha256(new TextEncoder().encode(canonical));
  const sig = await signDetached(digest, kp.privateKey);

  const handprint: HandprintObject = {
    ...unsigned,
    sig: toBase64url(sig),
  };

  const hash = await writeObject(
    hpDir,
    handprint as unknown as Record<string, unknown>,
  );

  setRef(hpDir, 'HEAD', hash);
  appendFileSync(join(hpDir, 'log'), hash + '\n', 'utf-8');

  return { hash, handprint };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd ~/handprint && npx vitest run tests/builder/handprint.test.ts`
Expected: All 6 tests PASS

- [ ] **Step 6: Update store/objects.test.ts for async writeObject**

Update `tests/store/objects.test.ts` — change all `writeObject()` calls to `await writeObject()` and make test functions `async`.

- [ ] **Step 7: Run full store test suite**

Run: `cd ~/handprint && npx vitest run tests/store/`
Expected: All store tests PASS

- [ ] **Step 8: Commit**

```bash
git add src/builder/handprint.ts tests/builder/handprint.test.ts src/store/objects.ts
git add tests/store/objects.test.ts
git commit -m "feat: handprint object builder with sign, encrypt, chain"
```

---

### Task 5: Hub API Client + Push + Login

**Files:**
- Create: `src/hub/client.ts`
- Create: `tests/hub/client.test.ts`
- Modify: `src/commands/push.ts`
- Create: `src/commands/login.ts`
- Delete: `tests/commands/push.test.ts` (will be replaced)

**Interfaces:**
- Consumes:
  - `loadGlobalConfig()` from `src/dirs/global.ts`
  - `loadProjectConfig()` from `src/dirs/project.ts`
  - `HandprintObject`, `PushHandprintInput`, `RegisterKeyInput` from `@handprint-sh/types`
- Produces:
  - `createHubClient(hubUrl: string, token?: string): HubClient`
  - `HubClient.pushHandprint(handprint: PushHandprintInput): Promise<{ ok: boolean }>`
  - `HubClient.registerKey(input: RegisterKeyInput): Promise<{ ok: boolean }>`
  - `HubClient.deviceCodeStart(): Promise<{ deviceCode: string; userCode: string; verificationUrl: string }>`
  - `HubClient.deviceCodePoll(deviceCode: string): Promise<{ accessToken: string } | null>`
  - `push(projectRoot: string): Promise<PushResult>` — reads unpushed handprints, sends to hub

- [ ] **Step 1: Write failing hub client tests**

Create `tests/hub/client.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHubClient } from '../../src/hub/client.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('hub client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('pushHandprint sends POST to /v1/push/handprint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 200 }),
    });

    const client = createHubClient('https://api.handprint.sh', 'test-token');
    const handprint = {
      v: 1 as const,
      ts: '2026-06-26T00:00:00Z',
      marks: [{ type: 'choice' as const, subtype: 'override' as const, note: 'test' }],
      artifacts: [],
      source: { agent: 'test' },
      parent: null,
      sig: 'abc',
      pubkey: 'def',
    };

    const result = await client.pushHandprint(handprint);
    expect(result.ok).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.handprint.sh/v1/push/handprint',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('registerKey sends POST to /v1/keys', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 200 }),
    });

    const client = createHubClient('https://api.handprint.sh', 'test-token');
    const result = await client.registerKey({ pubkey: 'abc', label: 'MacBook' });
    expect(result.ok).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.handprint.sh/v1/keys',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pubkey: 'abc', label: 'MacBook' }),
      }),
    );
  });

  it('pushHandprint throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'bad request' }),
    });

    const client = createHubClient('https://api.handprint.sh', 'test-token');
    await expect(
      client.pushHandprint({
        v: 1 as const,
        ts: '',
        marks: [{ type: 'choice' as const, subtype: 'override' as const, note: 'x' }],
        artifacts: [],
        source: { agent: 'test' },
        parent: null,
        sig: 'a',
        pubkey: 'b',
      }),
    ).rejects.toThrow();
  });

  it('deviceCodeStart sends POST to /v1/auth/device', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        deviceCode: 'dev123',
        userCode: 'ABCD-EFGH',
        verificationUrl: 'https://handprint.sh/device',
        expiresIn: 900,
        interval: 5,
      }),
    });

    const client = createHubClient('https://api.handprint.sh');
    const result = await client.deviceCodeStart();
    expect(result.deviceCode).toBe('dev123');
    expect(result.userCode).toBe('ABCD-EFGH');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd ~/handprint && npx vitest run tests/hub/client.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement hub client**

Create `src/hub/client.ts`:

```typescript
import type { PushHandprintInput, RegisterKeyInput } from '@handprint-sh/types';

export interface HubClient {
  pushHandprint(handprint: PushHandprintInput): Promise<{ ok: boolean }>;
  registerKey(input: RegisterKeyInput): Promise<{ ok: boolean }>;
  deviceCodeStart(): Promise<{
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
  }>;
  deviceCodePoll(deviceCode: string): Promise<{ accessToken: string } | null>;
}

export function createHubClient(hubUrl: string, token?: string): HubClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  async function request(path: string, method: string, body?: unknown): Promise<any> {
    const resp = await fetch(`${hubUrl}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(`Hub API ${resp.status}: ${data.message ?? 'unknown error'}`);
    }
    return data;
  }

  return {
    async pushHandprint(handprint: PushHandprintInput) {
      await request('/v1/push/handprint', 'POST', handprint);
      return { ok: true };
    },

    async registerKey(input: RegisterKeyInput) {
      await request('/v1/keys', 'POST', input);
      return { ok: true };
    },

    async deviceCodeStart() {
      return request('/v1/auth/device', 'POST', {});
    },

    async deviceCodePoll(deviceCode: string) {
      try {
        const data = await request('/v1/auth/token', 'POST', { device_code: deviceCode });
        if (data.accessToken) return { accessToken: data.accessToken };
        return null;
      } catch {
        return null;
      }
    },
  };
}
```

- [ ] **Step 4: Run hub client tests**

Run: `cd ~/handprint && npx vitest run tests/hub/client.test.ts`
Expected: All 4 tests PASS

- [ ] **Step 5: Rewrite push command**

Replace `src/commands/push.ts`:

```typescript
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { loadGlobalConfig } from '../dirs/global.js';
import { loadProjectConfig, projectDir } from '../dirs/project.js';
import { readObject } from '../store/objects.js';
import { getRef } from '../store/refs.js';
import { createHubClient } from '../hub/client.js';
import type { PushHandprintInput, HandprintObject } from '@handprint-sh/types';

export interface PushResult {
  pushed: number;
  skipped: number;
  visibility: string;
}

function loadToken(): string {
  const { globalDir } = require('../dirs/global.js');
  const credPath = join(globalDir(), 'credentials.json');
  if (!existsSync(credPath)) {
    throw new Error('not logged in: run "handprint login" first');
  }
  const creds = JSON.parse(readFileSync(credPath, 'utf-8'));
  if (!creds.accessToken) {
    throw new Error('no access token: run "handprint login" first');
  }
  return creds.accessToken;
}

export async function push(projectRoot: string): Promise<PushResult> {
  const config = loadProjectConfig(projectRoot);

  if (config.visibility === 'private') {
    return { pushed: 0, skipped: 0, visibility: 'private' };
  }

  const globalConfig = loadGlobalConfig();
  const token = loadToken();
  const client = createHubClient(globalConfig.hub.url, token);

  const hpDir = projectDir(projectRoot);
  const logPath = join(hpDir, 'log');

  if (!existsSync(logPath)) {
    return { pushed: 0, skipped: 0, visibility: config.visibility };
  }

  const hashes = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);

  let pushed = 0;
  let skipped = 0;

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!obj) {
      skipped++;
      continue;
    }

    const hp = obj as unknown as HandprintObject;
    const input: PushHandprintInput = {
      v: hp.v,
      ts: hp.ts,
      marks: hp.marks,
      artifacts: hp.artifacts,
      source: hp.source,
      parent: hp.parent,
      sig: hp.sig,
      pubkey: hp.pubkey,
    };

    try {
      await client.pushHandprint(input);
      pushed++;
    } catch (err) {
      console.error(`  failed to push ${hash.slice(0, 10)}: ${(err as Error).message}`);
      skipped++;
    }
  }

  return { pushed, skipped, visibility: config.visibility };
}
```

- [ ] **Step 6: Implement login command**

Create `src/commands/login.ts`:

```typescript
import { writeFileSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGlobalConfig, globalDir } from '../dirs/global.js';
import { encrypt } from '../crypto/sodium.js';
import { createHubClient } from '../hub/client.js';

export async function login(): Promise<{ handle: string }> {
  const config = loadGlobalConfig();
  const client = createHubClient(config.hub.url);

  const { deviceCode, userCode, verificationUrl, interval } =
    await client.deviceCodeStart();

  console.log(`\nOpen this URL in your browser:\n  ${verificationUrl}\n`);
  console.log(`Enter this code: ${userCode}\n`);
  console.log('Waiting for authorization...');

  let token: string | null = null;
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const result = await client.deviceCodePoll(deviceCode);
    if (result) {
      token = result.accessToken;
      break;
    }
  }

  if (!token) {
    throw new Error('login timed out');
  }

  const credPath = join(globalDir(), 'credentials.json');
  writeFileSync(
    credPath,
    JSON.stringify({ accessToken: token }, null, 2),
    { mode: 0o600 },
  );

  return { handle: config.identity.handle };
}
```

- [ ] **Step 7: Commit**

```bash
git add src/hub/client.ts tests/hub/client.test.ts src/commands/push.ts src/commands/login.ts
git add -u tests/commands/push.test.ts
git commit -m "feat: hub API client, push via API, device auth login"
```

---

### Task 6: Verify + Log + Show + Status Commands

**Files:**
- Modify: `src/commands/verify.ts`
- Modify: `src/commands/log.ts`
- Modify: `src/commands/show.ts`
- Create: `src/commands/status.ts`
- Modify: `tests/commands/verify.test.ts`
- Modify: `tests/commands/log.test.ts`
- Modify: `tests/commands/show.test.ts`
- Create: `tests/commands/status.test.ts`

**Interfaces:**
- Consumes:
  - `readObject()` from `src/store/objects.ts`
  - `getRef()` from `src/store/refs.ts`
  - `hashObject()`, `canonicalize()`, `sha256()` from `src/store/hash.ts`
  - `verifyDetached()`, `fromBase64url()`, `ensureSodium()` from `src/crypto/sodium.ts`
  - `decrypt()`, `deriveEncryptionKey()` from `src/crypto/sodium.ts`
  - `loadSeed()` from `src/dirs/global.ts`
  - `projectDir()`, `findProjectRoot()` from `src/dirs/project.ts`
  - `HandprintObject` from `@handprint-sh/types`
- Produces:
  - `verifyChain(projectRoot: string): Promise<VerifyResult>`
  - `listHandprints(projectRoot: string, options?): HandprintEntry[]`
  - `showHandprint(projectRoot: string, ref: string, options?): Promise<HandprintDetail | null>`
  - `status(projectRoot: string): Promise<StatusResult>`

- [ ] **Step 1: Write failing verify test**

Replace `tests/commands/verify.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-verify-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-verify-proj-${Date.now()}`);

describe('verifyChain', () => {
  beforeEach(async () => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;

    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    await initGlobal({ handle: 'test', name: 'Test', email: 't@t.com' });
    initProject(TEST_PROJECT);
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('returns valid for empty chain', async () => {
    const { verifyChain } = await import('../../src/commands/verify.js');
    const result = await verifyChain(TEST_PROJECT);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(0);
  });

  it('verifies a chain of two handprints', async () => {
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { verifyChain } = await import('../../src/commands/verify.js');

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'first' }],
      source: { agent: 'test' },
      plaintext: 'first',
    });

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'vision', subtype: 'goal', note: 'second' }],
      source: { agent: 'test' },
      plaintext: 'second',
    });

    const result = await verifyChain(TEST_PROJECT);
    expect(result.valid).toBe(true);
    expect(result.chainLength).toBe(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/verify.test.ts`
Expected: FAIL

- [ ] **Step 3: Rewrite verify command**

Replace `src/commands/verify.ts`:

```typescript
import { existsSync } from 'node:fs';
import { readObject } from '../store/objects.js';
import { hashObject, canonicalize, sha256 } from '../store/hash.js';
import { getRef } from '../store/refs.js';
import { verifyDetached, fromBase64url, ensureSodium } from '../crypto/sodium.js';
import { projectDir } from '../dirs/project.js';
import type { HandprintObject } from '@handprint-sh/types';

export interface VerifyResult {
  valid: boolean;
  chainLength: number;
  head: string | null;
  errors: Array<{ hash: string; error: string }>;
}

export async function verifyChain(projectRoot: string): Promise<VerifyResult> {
  await ensureSodium();
  const hpDir = projectDir(projectRoot);

  if (!existsSync(hpDir)) {
    throw new Error('not initialized');
  }

  const head = getRef(hpDir, 'HEAD');
  if (head === null) {
    return { valid: true, chainLength: 0, head: null, errors: [] };
  }

  const errors: Array<{ hash: string; error: string }> = [];
  let currentHash: string | null = head;
  let chainLength = 0;

  while (currentHash !== null) {
    const obj = readObject(hpDir, currentHash);
    if (obj === null) {
      errors.push({ hash: currentHash, error: 'object missing' });
      break;
    }

    const recomputedHash = await hashObject(obj);
    if (recomputedHash !== currentHash) {
      errors.push({ hash: currentHash, error: 'hash mismatch' });
      break;
    }

    const hp = obj as unknown as HandprintObject;

    const { sig, ...unsigned } = hp;
    const canonical = canonicalize(unsigned as unknown as Record<string, unknown>);
    const digest = sha256(new TextEncoder().encode(canonical));
    const sigBytes = fromBase64url(sig);
    const pubkeyBytes = fromBase64url(hp.pubkey);
    const sigValid = await verifyDetached(sigBytes, digest, pubkeyBytes);

    if (!sigValid) {
      errors.push({ hash: currentHash, error: 'invalid signature' });
      break;
    }

    chainLength++;
    currentHash = hp.parent;
  }

  return { valid: errors.length === 0, chainLength, head, errors };
}
```

- [ ] **Step 4: Run verify tests**

Run: `cd ~/handprint && npx vitest run tests/commands/verify.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Rewrite log command**

Replace `src/commands/log.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readObject } from '../store/objects.js';
import { projectDir } from '../dirs/project.js';
import type { HandprintObject } from '@handprint-sh/types';

export interface HandprintEntry {
  hash: string;
  handprint: HandprintObject;
}

export interface ListOptions {
  type?: string;
  limit?: number;
}

export function listHandprints(
  projectRoot: string,
  options?: ListOptions,
): HandprintEntry[] {
  const hpDir = projectDir(projectRoot);
  const logPath = join(hpDir, 'log');

  if (!existsSync(logPath)) return [];

  const hashes = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
  const entries: HandprintEntry[] = [];

  for (const hash of hashes) {
    const obj = readObject(hpDir, hash);
    if (!obj) continue;
    const hp = obj as unknown as HandprintObject;

    if (options?.type) {
      const hasType = hp.marks.some((m) => m.type === options.type);
      if (!hasType) continue;
    }

    entries.push({ hash, handprint: hp });
  }

  if (options?.limit) {
    return entries.slice(-options.limit);
  }

  return entries;
}
```

- [ ] **Step 6: Rewrite show command**

Replace `src/commands/show.ts`:

```typescript
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readObject } from '../store/objects.js';
import { projectDir } from '../dirs/project.js';
import { loadSeed } from '../dirs/global.js';
import { deriveEncryptionKey, decrypt } from '../crypto/sodium.js';
import type { HandprintObject } from '@handprint-sh/types';

export interface HandprintDetail {
  hash: string;
  handprint: HandprintObject;
  decryptedPayload?: string;
}

export async function showHandprint(
  projectRoot: string,
  ref: string,
  options?: { decrypt?: boolean },
): Promise<HandprintDetail | null> {
  const hpDir = projectDir(projectRoot);
  let fullHash: string | null = null;

  if (ref.length === 64) {
    fullHash = ref;
  } else if (ref.length >= 7) {
    fullHash = resolvePrefix(hpDir, ref);
  }

  if (!fullHash) return null;

  const obj = readObject(hpDir, fullHash);
  if (!obj) return null;

  const hp = obj as unknown as HandprintObject;
  const result: HandprintDetail = { hash: fullHash, handprint: hp };

  if (options?.decrypt && hp.payload) {
    try {
      const seed = loadSeed();
      const encKey = await deriveEncryptionKey(seed);
      result.decryptedPayload = await decrypt(hp.payload, encKey);
    } catch {
      // decryption failed
    }
  }

  return result;
}

function resolvePrefix(hpDir: string, prefix: string): string | null {
  const dirPrefix = prefix.slice(0, 2);
  const filePrefix = prefix.slice(2);
  const bucketDir = join(hpDir, 'objects', dirPrefix);

  if (!existsSync(bucketDir)) return null;

  const files = readdirSync(bucketDir);
  const matches = files.filter((f) => f.startsWith(filePrefix));

  if (matches.length !== 1) return null;
  return dirPrefix + matches[0];
}
```

- [ ] **Step 7: Implement status command**

Create `src/commands/status.ts`:

```typescript
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isGlobalInitialized, loadSeed, loadGlobalConfig } from '../dirs/global.js';
import { isProjectInitialized, loadProjectConfig, projectDir } from '../dirs/project.js';
import { deriveKeypair, fingerprint, toBase64url, ensureSodium } from '../crypto/sodium.js';
import { getRef } from '../store/refs.js';

export interface StatusResult {
  globalInitialized: boolean;
  projectInitialized: boolean;
  handle: string | null;
  fingerprint: string | null;
  visibility: string | null;
  chainHead: string | null;
  chainLength: number;
}

export async function status(projectRoot: string): Promise<StatusResult> {
  await ensureSodium();

  const result: StatusResult = {
    globalInitialized: isGlobalInitialized(),
    projectInitialized: isProjectInitialized(projectRoot),
    handle: null,
    fingerprint: null,
    visibility: null,
    chainHead: null,
    chainLength: 0,
  };

  if (result.globalInitialized) {
    const config = loadGlobalConfig();
    result.handle = config.identity.handle;

    try {
      const seed = loadSeed();
      const kp = await deriveKeypair(seed);
      result.fingerprint = fingerprint(kp.publicKey);
    } catch { /* seed missing */ }
  }

  if (result.projectInitialized) {
    const config = loadProjectConfig(projectRoot);
    result.visibility = config.visibility;

    const hpDir = projectDir(projectRoot);
    result.chainHead = getRef(hpDir, 'HEAD');

    const logPath = join(hpDir, 'log');
    if (existsSync(logPath)) {
      const lines = readFileSync(logPath, 'utf-8').trim().split('\n').filter(Boolean);
      result.chainLength = lines.length;
    }
  }

  return result;
}
```

- [ ] **Step 8: Write status test**

Create `tests/commands/status.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const TEST_HOME = join(tmpdir(), `hp-test-status-${Date.now()}`);
const TEST_PROJECT = join(tmpdir(), `hp-test-status-proj-${Date.now()}`);

describe('status', () => {
  beforeEach(() => {
    mkdirSync(TEST_HOME, { recursive: true });
    mkdirSync(TEST_PROJECT, { recursive: true });
    process.env.HANDPRINT_HOME = TEST_HOME;
  });

  afterEach(() => {
    rmSync(TEST_HOME, { recursive: true, force: true });
    rmSync(TEST_PROJECT, { recursive: true, force: true });
    delete process.env.HANDPRINT_HOME;
  });

  it('reports not initialized', async () => {
    const { status } = await import('../../src/commands/status.js');
    const result = await status(TEST_PROJECT);
    expect(result.globalInitialized).toBe(false);
    expect(result.projectInitialized).toBe(false);
  });

  it('reports initialized with fingerprint', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    const { status } = await import('../../src/commands/status.js');

    await initGlobal({ handle: 'test', name: 'Test', email: 't@t.com' });
    initProject(TEST_PROJECT);

    const result = await status(TEST_PROJECT);
    expect(result.globalInitialized).toBe(true);
    expect(result.projectInitialized).toBe(true);
    expect(result.handle).toBe('test');
    expect(result.fingerprint).toMatch(/^[A-Za-z0-9_-]{16}$/);
    expect(result.visibility).toBe('private');
    expect(result.chainLength).toBe(0);
  });

  it('reports chain length after building handprints', async () => {
    const { initGlobal } = await import('../../src/dirs/global.js');
    const { initProject } = await import('../../src/dirs/project.js');
    const { buildHandprint } = await import('../../src/builder/handprint.js');
    const { status } = await import('../../src/commands/status.js');

    await initGlobal({ handle: 'test', name: 'Test', email: 't@t.com' });
    initProject(TEST_PROJECT);

    await buildHandprint({
      projectRoot: TEST_PROJECT,
      marks: [{ type: 'choice', subtype: 'override', note: 'test' }],
      source: { agent: 'test' },
      plaintext: 'test',
    });

    const result = await status(TEST_PROJECT);
    expect(result.chainLength).toBe(1);
    expect(result.chainHead).toMatch(/^[a-f0-9]{64}$/);
  });
});
```

- [ ] **Step 9: Run all updated command tests**

Run: `cd ~/handprint && npx vitest run tests/commands/verify.test.ts tests/commands/status.test.ts`
Expected: All tests PASS

- [ ] **Step 10: Commit**

```bash
git add src/commands/verify.ts src/commands/log.ts src/commands/show.ts src/commands/status.ts
git add tests/commands/verify.test.ts tests/commands/status.test.ts
git add -u tests/commands/log.test.ts tests/commands/show.test.ts
git commit -m "feat: verify, log, show, status commands for v2 object model"
```

---

### Task 7: Scanner Update + Grab Command

**Files:**
- Modify: `src/scanner/ai-extractor.ts`
- Modify: `src/commands/grab.ts`
- Delete: `src/scanner/git.ts`
- Delete: `src/commands/scan.ts`
- Delete: `tests/scanner/git.test.ts`

**Interfaces:**
- Consumes:
  - `buildHandprint()` from `src/builder/handprint.ts`
  - `Mark`, `Source`, `Artifact` from `@handprint-sh/types`
  - `discoverTranscripts()`, `loadTranscriptEntries()` from `src/scanner/ai-extractor.ts`
  - `findProjectRoot()` from `src/dirs/project.ts`
- Produces:
  - Updated `extractHandprintsFromTranscript()` that returns `Mark[]` instead of old `ExtractedHandprint`
  - Updated `grab()` that builds handprint objects via the builder

- [ ] **Step 1: Update the extractor interface and prompt**

Modify `src/scanner/ai-extractor.ts`:

Update `ExtractedHandprint` to match the new marks model:

```typescript
import type { Mark, Artifact } from '@handprint-sh/types';

export interface ExtractedHandprint {
  marks: Mark[];
  artifacts: Artifact[];
  timestamp: string;
}
```

Update `SYSTEM_PROMPT` to instruct the model to output the new marks format:

```typescript
const SYSTEM_PROMPT = `You are a handprint detector. You analyze conversations between a human and an AI assistant to identify moments of human judgment — decisions where the human steered the work.

There are three types of marks:

1. **vision** — What the human wants to achieve.
   Subtypes: goal, direction, principle

2. **choice** — Decisions the human made.
   Subtypes: approval, override, rejection, constraint, inquiry

3. **method** — Tools and knowledge the human applied.
   Subtypes: tool, knowledge, process

For each decision moment, return an object with:
- marks: array of { type, subtype, note } — note is 1-280 chars describing the decision
- artifacts: array of { type, uri } — any outputs referenced (git-commit, file, url, deployment, etc.)
- timestamp: the ISO timestamp from the conversation

IMPORTANT:
- Only flag moments where a HUMAN made a real decision
- Routine instructions are NOT handprints
- Simple approvals without constraints are NOT handprints
- "Never do X" / "always do Y" = choice/constraint
- Tool/framework selections = method/tool or method/process
- Each note should be a concise third-person description of what the human decided

Respond ONLY with a JSON array. No markdown. If none found, return [].`;
```

Update the extraction function to parse the new format and validate marks against the schema.

- [ ] **Step 2: Rewrite grab command**

Replace `src/commands/grab.ts`:

```typescript
import { existsSync } from 'node:fs';
import {
  discoverTranscripts,
  loadTranscriptEntries,
  extractHandprintsFromTranscript,
} from '../scanner/ai-extractor.js';
import { buildHandprint } from '../builder/handprint.js';
import { findProjectRoot, isProjectInitialized } from '../dirs/project.js';
import { isGlobalInitialized } from '../dirs/global.js';
import type { TranscriptEntry } from '../scanner/claude-code.js';

export interface GrabResult {
  handprintsCreated: number;
  sessionsScanned: number;
  details: Array<{
    hash: string;
    marks: Array<{ type: string; subtype: string; note: string }>;
  }>;
}

function chunkByTimeGap(
  entries: TranscriptEntry[],
  gapMs: number = 5 * 60 * 1000,
): TranscriptEntry[][] {
  if (entries.length === 0) return [];

  const chunks: TranscriptEntry[][] = [];
  let current: TranscriptEntry[] = [entries[0]];

  for (let i = 1; i < entries.length; i++) {
    const prevTs = new Date(entries[i - 1].timestamp).getTime();
    const currTs = new Date(entries[i].timestamp).getTime();

    if (currTs - prevTs > gapMs || isNaN(prevTs) || isNaN(currTs)) {
      chunks.push(current);
      current = [entries[i]];
    } else {
      current.push(entries[i]);
    }
  }

  if (current.length > 0) chunks.push(current);
  return chunks;
}

function buildChunkPlaintext(entries: TranscriptEntry[]): string {
  return entries
    .map((e) => {
      const role = e.role === 'user' ? 'user' : 'assistant';
      const time = e.timestamp.slice(11, 16);
      const text = e.text.slice(0, 1000);
      return `[${role} ${time}] ${text}`;
    })
    .join('\n');
}

export async function grab(
  cwd: string,
  options?: {
    claudeDir?: string;
    limit?: number;
    dryRun?: boolean;
  },
): Promise<GrabResult> {
  const projectRoot = findProjectRoot(cwd);
  if (!projectRoot && !options?.dryRun) {
    throw new Error('not initialized: run "handprint init" first');
  }
  if (!isGlobalInitialized() && !options?.dryRun) {
    throw new Error('global config not found: run "handprint init --global" first');
  }

  const transcripts = discoverTranscripts(options?.claudeDir);
  const limit = options?.limit ?? transcripts.length;
  const toProcess = transcripts.slice(0, limit);

  const result: GrabResult = {
    handprintsCreated: 0,
    sessionsScanned: 0,
    details: [],
  };

  for (const transcript of toProcess) {
    result.sessionsScanned++;
    console.error(
      `scanning ${transcript.project} / ${transcript.sessionId.slice(0, 8)}...`,
    );

    const entries = loadTranscriptEntries(transcript.path);
    if (entries.length === 0) continue;

    const chunks = chunkByTimeGap(entries);

    for (const chunk of chunks) {
      const plaintext = buildChunkPlaintext(chunk);
      if (!plaintext.trim()) continue;

      const extraction = await extractHandprintsFromTranscript(
        chunk,
        transcript.sessionId,
        transcript.project,
      );

      for (const hp of extraction.handprints) {
        if (hp.marks.length === 0) continue;

        if (options?.dryRun) {
          result.details.push({
            hash: '(dry-run)',
            marks: hp.marks,
          });
          result.handprintsCreated++;
          continue;
        }

        const built = await buildHandprint({
          projectRoot: projectRoot!,
          marks: hp.marks,
          artifacts: hp.artifacts,
          source: {
            agent: 'claude-code',
            session: transcript.sessionId,
          },
          plaintext,
        });

        result.details.push({
          hash: built.hash,
          marks: built.handprint.marks,
        });
        result.handprintsCreated++;
      }
    }
  }

  return result;
}
```

- [ ] **Step 3: Delete old scanner files**

```bash
rm src/scanner/git.ts src/commands/scan.ts tests/scanner/git.test.ts
```

- [ ] **Step 4: Run existing scanner test**

Run: `cd ~/handprint && npx vitest run tests/scanner/claude-code.test.ts`
Expected: PASS (unchanged transcript parser)

- [ ] **Step 5: Commit**

```bash
git add src/scanner/ai-extractor.ts src/commands/grab.ts
git add -u src/scanner/git.ts src/commands/scan.ts tests/scanner/git.test.ts
git commit -m "feat: grab command builds v2 handprint objects with marks"
```

---

### Task 8: Key Management + CLI Wiring + Cleanup

**Files:**
- Create: `src/commands/keys.ts`
- Modify: `src/commands/config.ts`
- Modify: `src/index.ts`
- Modify: `bin/handprint.ts`
- Delete: `src/model/handprint.ts`, `src/model/meta.ts`, `src/model/seal.ts`, `src/model/resolution.ts`
- Delete: `src/store/meta.ts`
- Delete: `src/profile/types.ts`, `src/profile/anchors.ts`, `src/profile/compute.ts`
- Delete: `src/commands/seal.ts`, `src/commands/export.ts`
- Delete: all corresponding test files for deleted modules

**Interfaces:**
- Consumes:
  - `loadSeed()`, `loadGlobalConfig()`, `globalDir()` from `src/dirs/global.ts`
  - `deriveKeypair()`, `fingerprint()`, `toBase64url()`, `generateSeed()` from `src/crypto/sodium.ts`
  - `createHubClient()` from `src/hub/client.ts`
- Produces:
  - `keysAdd(label: string): Promise<void>` — register current device's public key
  - `keysList(): Promise<void>` — list registered keys (local info)
  - `keysRotate(): Promise<void>` — generate new seed, register, retire old
  - `keysRevoke(fp: string): Promise<void>` — mark a key as compromised
  - `keysExport(): Promise<void>` — print seed (with confirmation)

- [ ] **Step 1: Implement keys command**

Create `src/commands/keys.ts`:

```typescript
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadSeed, loadGlobalConfig, globalDir } from '../dirs/global.js';
import {
  deriveKeypair,
  fingerprint,
  toBase64url,
  generateSeed,
  ensureSodium,
} from '../crypto/sodium.js';
import { createHubClient } from '../hub/client.js';

function loadToken(): string {
  const credPath = join(globalDir(), 'credentials.json');
  const creds = JSON.parse(readFileSync(credPath, 'utf-8'));
  if (!creds.accessToken) throw new Error('not logged in');
  return creds.accessToken;
}

export async function keysAdd(label: string): Promise<{ fingerprint: string }> {
  await ensureSodium();
  const seed = loadSeed();
  const kp = await deriveKeypair(seed);
  const fp = fingerprint(kp.publicKey);
  const pubkey = toBase64url(kp.publicKey);

  const config = loadGlobalConfig();
  const token = loadToken();
  const client = createHubClient(config.hub.url, token);

  await client.registerKey({ pubkey, label });

  return { fingerprint: fp };
}

export async function keysList(): Promise<{
  fingerprint: string;
  pubkey: string;
}> {
  await ensureSodium();
  const seed = loadSeed();
  const kp = await deriveKeypair(seed);
  return {
    fingerprint: fingerprint(kp.publicKey),
    pubkey: toBase64url(kp.publicKey),
  };
}

export async function keysRotate(): Promise<{ fingerprint: string }> {
  await ensureSodium();
  const newSeed = await generateSeed();
  const kp = await deriveKeypair(newSeed);
  const fp = fingerprint(kp.publicKey);

  const seedPath = join(globalDir(), 'keys', 'seed');
  writeFileSync(seedPath, toBase64url(newSeed), { mode: 0o600 });

  return { fingerprint: fp };
}

export async function keysExport(): Promise<string> {
  const seed = loadSeed();
  return toBase64url(seed);
}
```

- [ ] **Step 2: Rewrite config command for two-tier**

Replace `src/commands/config.ts`:

```typescript
import {
  loadGlobalConfig,
  saveGlobalConfig,
  isGlobalInitialized,
} from '../dirs/global.js';
import {
  loadProjectConfig,
  saveProjectConfig,
  isProjectInitialized,
} from '../dirs/project.js';

export function getConfig(cwd: string, scope: 'global' | 'project' = 'project'): unknown {
  if (scope === 'global') {
    return loadGlobalConfig();
  }
  return loadProjectConfig(cwd);
}

export function getConfigValue(config: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setConfigValue(
  config: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const result = JSON.parse(JSON.stringify(config));
  const parts = path.split('.');
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  if (typeof value === 'string') {
    if (value === 'true') value = true;
    else if (value === 'false') value = false;
    else if (!isNaN(Number(value)) && value !== '') value = Number(value);
  }
  current[parts[parts.length - 1]] = value;
  return result;
}
```

- [ ] **Step 3: Update exports**

Replace `src/index.ts`:

```typescript
export { init } from './commands/init.js';
export { grab } from './commands/grab.js';
export { push } from './commands/push.js';
export { verifyChain } from './commands/verify.js';
export { listHandprints } from './commands/log.js';
export { showHandprint } from './commands/show.js';
export { status } from './commands/status.js';
export { login } from './commands/login.js';
export { keysAdd, keysList, keysRotate, keysExport } from './commands/keys.js';
export { buildHandprint } from './builder/handprint.js';
export {
  globalDir,
  isGlobalInitialized,
  loadGlobalConfig,
  loadSeed,
} from './dirs/global.js';
export {
  projectDir,
  isProjectInitialized,
  findProjectRoot,
  loadProjectConfig,
} from './dirs/project.js';
```

- [ ] **Step 4: Rewrite CLI entry point**

Replace `bin/handprint.ts`:

```typescript
#!/usr/bin/env npx tsx

import { Command } from 'commander';
import { init } from '../src/commands/init.js';
import { grab } from '../src/commands/grab.js';
import { push } from '../src/commands/push.js';
import { verifyChain } from '../src/commands/verify.js';
import { listHandprints } from '../src/commands/log.js';
import { showHandprint } from '../src/commands/show.js';
import { status } from '../src/commands/status.js';
import { login } from '../src/commands/login.js';
import { keysAdd, keysList, keysRotate, keysExport } from '../src/commands/keys.js';
import { getConfig, getConfigValue, setConfigValue } from '../src/commands/config.js';
import type { Visibility } from '@handprint-sh/types';

const program = new Command();

program
  .name('handprint')
  .description('Human decision provenance for the age of AI')
  .version('0.2.0');

program
  .command('init')
  .description('Initialize handprint (global identity + project)')
  .option('--global', 'Initialize global identity at ~/.handprint/')
  .option('--visibility <level>', 'Project visibility: private, unlisted, public', 'private')
  .action(async (opts) => {
    try {
      const path = await init(process.cwd(), {
        global: opts.global,
        visibility: opts.visibility as Visibility,
      });
      console.log(path);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('login')
  .description('Authenticate with the handprint hub')
  .action(async () => {
    try {
      const result = await login();
      console.log(`logged in as ${result.handle}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('grab')
  .description('Extract decisions from AI transcripts')
  .option('-n, --limit <n>', 'Sessions to scan', parseInt)
  .option('--dry-run', 'Show what would be extracted')
  .action(async (opts) => {
    try {
      const result = await grab(process.cwd(), {
        limit: opts.limit,
        dryRun: opts.dryRun,
      });

      if (result.handprintsCreated === 0) {
        console.log('no decisions found');
        return;
      }

      console.log(
        `\n${result.handprintsCreated} handprints from ${result.sessionsScanned} sessions\n`,
      );

      for (const { hash, marks } of result.details) {
        const prefix = opts.dryRun ? '  ' : `  ${hash.slice(0, 10)}  `;
        for (const m of marks) {
          const symbol = { vision: 'o', choice: '+', method: '*' }[m.type] ?? '?';
          console.log(`${prefix}${symbol} [${m.type}/${m.subtype}]  ${m.note}`);
        }
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('push')
  .description('Publish handprints to the hub')
  .action(async () => {
    try {
      const result = await push(process.cwd());
      if (result.visibility === 'private') {
        console.log('project is private — nothing pushed');
        return;
      }
      console.log(`pushed ${result.pushed} handprints (${result.skipped} skipped)`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('log')
  .description('List local handprints')
  .option('-t, --type <type>', 'Filter by mark type')
  .option('-n, --limit <n>', 'Limit results', parseInt)
  .action((opts) => {
    const entries = listHandprints(process.cwd(), {
      type: opts.type,
      limit: opts.limit,
    });
    if (entries.length === 0) {
      console.log('no handprints yet');
      return;
    }
    for (const { hash, handprint } of entries) {
      const h = hash.slice(0, 10);
      const ts = handprint.ts.slice(0, 10);
      const types = handprint.marks.map((m) => `${m.type}/${m.subtype}`).join(', ');
      const note = handprint.marks[0]?.note.slice(0, 60) ?? '';
      console.log(`${h}  ${ts}  [${types}]  ${note}`);
    }
  });

program
  .command('show <ref>')
  .description('Show a handprint by hash or prefix')
  .option('--decrypt', 'Decrypt the payload')
  .action(async (ref: string, opts) => {
    const detail = await showHandprint(process.cwd(), ref, {
      decrypt: opts.decrypt,
    });
    if (!detail) {
      console.error('handprint not found');
      process.exit(1);
    }
    console.log(JSON.stringify(detail, null, 2));
  });

program
  .command('verify')
  .description('Verify chain integrity and signatures')
  .action(async () => {
    try {
      const result = await verifyChain(process.cwd());
      if (result.chainLength === 0) {
        console.log('chain: empty');
        console.log('status: valid');
        return;
      }
      console.log(`chain: ${result.chainLength} handprint${result.chainLength === 1 ? '' : 's'}`);
      console.log(`head: ${result.head!.slice(0, 12)}`);
      if (result.valid) {
        console.log('status: valid — all hashes verified, signatures valid, chain intact');
      } else {
        console.log('status: INVALID');
        for (const { hash, error } of result.errors) {
          console.log(`  ${hash.slice(0, 12)} — ${error}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Chain state, auth status, key fingerprint')
  .action(async () => {
    const s = await status(process.cwd());
    if (!s.globalInitialized) {
      console.log('not initialized: run "handprint init --global"');
      return;
    }
    console.log(`handle:      ${s.handle}`);
    console.log(`fingerprint: ${s.fingerprint}`);
    console.log(`visibility:  ${s.visibility ?? 'n/a (no project)'}`);
    console.log(`chain:       ${s.chainLength} handprints`);
    if (s.chainHead) {
      console.log(`head:        ${s.chainHead.slice(0, 12)}`);
    }
  });

const keysCmd = program.command('keys').description('Manage signing keys');

keysCmd
  .command('add')
  .description('Register this device\'s key with the hub')
  .requiredOption('--label <label>', 'Device label (e.g. "MacBook Pro")')
  .action(async (opts) => {
    try {
      const result = await keysAdd(opts.label);
      console.log(`registered key ${result.fingerprint}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

keysCmd
  .command('list')
  .description('Show this device\'s key info')
  .action(async () => {
    const info = await keysList();
    console.log(`fingerprint: ${info.fingerprint}`);
    console.log(`pubkey:      ${info.pubkey}`);
  });

keysCmd
  .command('rotate')
  .description('Generate a new seed (old payloads become unreadable)')
  .action(async () => {
    console.log('WARNING: After rotation, payloads encrypted with the old seed cannot be decrypted.');
    console.log('Marks (your decision provenance) are permanent and unaffected.');
    const result = await keysRotate();
    console.log(`new key: ${result.fingerprint}`);
    console.log('Register the new key with: handprint keys add --label "..."');
  });

keysCmd
  .command('export')
  .description('Export seed for backup (handle with care)')
  .action(async () => {
    const seed = await keysExport();
    console.log(seed);
  });

const configCmd = program.command('config').description('Read or write configuration');

configCmd
  .command('show')
  .option('--global', 'Show global config')
  .action((opts) => {
    try {
      const config = getConfig(process.cwd(), opts.global ? 'global' : 'project');
      console.log(JSON.stringify(config, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command('get <path>')
  .option('--global', 'Read from global config')
  .action((path: string, opts) => {
    try {
      const config = getConfig(process.cwd(), opts.global ? 'global' : 'project');
      const value = getConfigValue(config as Record<string, unknown>, path);
      if (value === undefined) {
        console.error(`no value at path: ${path}`);
        process.exit(1);
      }
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command('set <path> <value>')
  .option('--global', 'Write to global config')
  .action((path: string, value: string, opts) => {
    try {
      const config = getConfig(process.cwd(), opts.global ? 'global' : 'project') as Record<string, unknown>;
      const updated = setConfigValue(config, path, value);
      if (opts.global) {
        const { saveGlobalConfig } = require('../src/dirs/global.js');
        saveGlobalConfig(updated);
      } else {
        const { saveProjectConfig } = require('../src/dirs/project.js');
        saveProjectConfig(process.cwd(), updated);
      }
      console.log(`set ${path} = ${JSON.stringify(getConfigValue(updated, path))}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
```

- [ ] **Step 5: Delete all dead code**

```bash
# Old model files
rm src/model/handprint.ts src/model/meta.ts src/model/seal.ts src/model/resolution.ts
rm tests/model/handprint.test.ts tests/model/resolution.test.ts

# Old store/meta
rm src/store/meta.ts tests/store/meta.test.ts

# Old profile
rm src/profile/types.ts src/profile/anchors.ts src/profile/compute.ts
rm tests/profile/anchors.test.ts tests/profile/compute.test.ts tests/profile/types.test.ts

# Old commands
rm src/commands/seal.ts src/commands/export.ts
rm tests/commands/seal.test.ts tests/commands/export.test.ts
```

- [ ] **Step 6: Remove empty directories if any**

```bash
rmdir src/model src/profile 2>/dev/null || true
rmdir tests/model tests/profile 2>/dev/null || true
```

- [ ] **Step 7: Run full test suite**

Run: `cd ~/handprint && npx vitest run`
Expected: All tests pass. No imports of deleted modules remain.

If any tests fail due to stale imports, fix the imports.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: key management, CLI v2 wiring, remove dead v1 code"
```

- [ ] **Step 9: Push**

```bash
git push
```

---

## Post-Implementation Verification

After all tasks are complete, verify:

1. `cd ~/handprint && npx vitest run` — all tests pass
2. `npx tsx bin/handprint.ts --help` — shows all v2 commands
3. `npx tsx bin/handprint.ts init --global` — creates `~/.handprint/` with seed
4. `npx tsx bin/handprint.ts init` — creates `.handprint/` in current dir
5. `npx tsx bin/handprint.ts status` — shows handle, fingerprint, chain state
6. `npx tsx bin/handprint.ts verify` — reports valid empty chain
7. Types package tests still pass: `cd packages/types && npx vitest run`
