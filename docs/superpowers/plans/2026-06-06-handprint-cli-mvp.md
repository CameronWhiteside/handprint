# Handprint CLI — MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local CLI tool that records human decision provenance (handprints) into `.handprint/` directories within git repos, using content-addressable SHA-256 storage, with AI-assisted scanning of git history and Claude Code transcripts.

**Architecture:** Content-addressable object store in `.handprint/objects/` (2-char prefix directories like git). Each handprint is a JSON document hashed with SHA-256. Resolutions are separate objects that reference their parent handprint hash. CLI built with Commander.js, tests with Vitest. Scanner uses Claude API to classify decision moments.

**Tech Stack:** TypeScript, Node.js 20+, Vitest, Commander.js, crypto (built-in SHA-256)

---

## File Structure

```
handprint/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── bin/
│   └── handprint.ts              # CLI entry point
├── src/
│   ├── store/
│   │   ├── hash.ts               # SHA-256 content addressing
│   │   ├── objects.ts            # Read/write objects to .handprint/objects/
│   │   └── refs.ts               # HEAD, tags, named references
│   ├── model/
│   │   ├── handprint.ts          # Handprint record type + validation
│   │   └── resolution.ts         # Resolution record type + validation
│   ├── commands/
│   │   ├── init.ts               # handprint init
│   │   ├── seal.ts               # handprint seal
│   │   ├── log.ts                # handprint log
│   │   ├── show.ts               # handprint show
│   │   ├── resolve.ts            # handprint resolve
│   │   ├── scan.ts               # handprint scan (AI-assisted)
│   │   └── export.ts             # handprint export
│   ├── scanner/
│   │   ├── git.ts                # Parse git log for decision signals
│   │   └── claude-code.ts        # Parse Claude Code transcripts
│   └── index.ts                  # Re-exports
├── tests/
│   ├── store/
│   │   ├── hash.test.ts
│   │   ├── objects.test.ts
│   │   └── refs.test.ts
│   ├── model/
│   │   ├── handprint.test.ts
│   │   └── resolution.test.ts
│   ├── commands/
│   │   ├── init.test.ts
│   │   ├── seal.test.ts
│   │   ├── log.test.ts
│   │   ├── show.test.ts
│   │   ├── resolve.test.ts
│   │   └── export.test.ts
│   └── scanner/
│       ├── git.test.ts
│       └── claude-code.test.ts
```

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Initialize project**

```bash
cd ~/handprint
npm init -y
```

- [ ] **Step 2: Install dependencies**

```bash
npm install commander
npm install -D typescript vitest @types/node tsx
```

- [ ] **Step 3: Write tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "bin/**/*", "tests/**/*"]
}
```

- [ ] **Step 4: Write vitest.config.ts**

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
```

- [ ] **Step 5: Update package.json scripts and bin**

Add to `package.json`:
```json
{
  "type": "module",
  "bin": {
    "handprint": "./bin/handprint.ts"
  },
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "handprint": "tsx bin/handprint.ts"
  }
}
```

- [ ] **Step 6: Create directory structure**

```bash
mkdir -p src/store src/model src/commands src/scanner tests/store tests/model tests/commands tests/scanner bin
```

- [ ] **Step 7: Verify vitest runs (empty)**

Run: `cd ~/handprint && npx vitest run`
Expected: "No test files found" or similar — confirms vitest is configured.

- [ ] **Step 8: Commit**

```bash
git init
git add -A
git commit -m "chore: scaffold handprint CLI project"
```

---

## Task 2: Content-Addressable Hash

**Files:**
- Create: `src/store/hash.ts`
- Create: `tests/store/hash.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// tests/store/hash.test.ts
import { describe, it, expect } from "vitest";
import { hashObject } from "../src/store/hash.js";

describe("hashObject", () => {
  it("returns a 64-char hex SHA-256 of the JSON content", () => {
    const obj = { type: "override", intent: "test" };
    const hash = hashObject(obj);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("returns the same hash for the same content regardless of key order", () => {
    const a = { type: "override", intent: "test" };
    const b = { intent: "test", type: "override" };
    expect(hashObject(a)).toBe(hashObject(b));
  });

  it("returns different hashes for different content", () => {
    const a = { type: "override", intent: "test" };
    const b = { type: "override", intent: "other" };
    expect(hashObject(a)).not.toBe(hashObject(b));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/store/hash.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/store/hash.ts
import { createHash } from "node:crypto";

function sortKeys(obj: unknown): unknown {
  if (obj === null || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(sortKeys);
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
    sorted[key] = sortKeys((obj as Record<string, unknown>)[key]);
  }
  return sorted;
}

export function hashObject(obj: Record<string, unknown>): string {
  const canonical = JSON.stringify(sortKeys(obj));
  return createHash("sha256").update(canonical).digest("hex");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/store/hash.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/hash.ts tests/store/hash.test.ts
git commit -m "feat(store): content-addressable SHA-256 hashing"
```

---

## Task 3: Object Store (read/write)

**Files:**
- Create: `src/store/objects.ts`
- Create: `tests/store/objects.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/store/objects.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeObject, readObject, objectExists } from "../src/store/objects.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("object store", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("writeObject returns a SHA-256 hash and stores the file", () => {
    const obj = { type: "override", intent: "edge JWT" };
    const hash = writeObject(dir, obj);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(objectExists(dir, hash)).toBe(true);
  });

  it("readObject returns the stored object", () => {
    const obj = { type: "override", intent: "edge JWT" };
    const hash = writeObject(dir, obj);
    const read = readObject(dir, hash);
    expect(read).toEqual(obj);
  });

  it("readObject returns null for missing hash", () => {
    const result = readObject(dir, "0".repeat(64));
    expect(result).toBeNull();
  });

  it("objectExists returns false for missing hash", () => {
    expect(objectExists(dir, "0".repeat(64))).toBe(false);
  });

  it("stores objects in 2-char prefix subdirectories", () => {
    const obj = { type: "constraint", intent: "no vendor auth" };
    const hash = writeObject(dir, obj);
    const prefix = hash.slice(0, 2);
    const rest = hash.slice(2);
    const { existsSync } = await import("node:fs");
    expect(existsSync(join(dir, "objects", prefix, rest))).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/store/objects.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/store/objects.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { hashObject } from "./hash.js";

function objectPath(storeDir: string, hash: string): string {
  return join(storeDir, "objects", hash.slice(0, 2), hash.slice(2));
}

export function writeObject(storeDir: string, obj: Record<string, unknown>): string {
  const hash = hashObject(obj);
  const path = objectPath(storeDir, hash);
  mkdirSync(join(storeDir, "objects", hash.slice(0, 2)), { recursive: true });
  writeFileSync(path, JSON.stringify(obj, null, 2));
  return hash;
}

export function readObject(storeDir: string, hash: string): Record<string, unknown> | null {
  const path = objectPath(storeDir, hash);
  if (!existsSync(path)) return null;
  return JSON.parse(readFileSync(path, "utf-8"));
}

export function objectExists(storeDir: string, hash: string): boolean {
  return existsSync(objectPath(storeDir, hash));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/store/objects.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/objects.ts tests/store/objects.test.ts
git commit -m "feat(store): object read/write with 2-char prefix dirs"
```

---

## Task 4: Refs (HEAD, named references)

**Files:**
- Create: `src/store/refs.ts`
- Create: `tests/store/refs.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/store/refs.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setRef, getRef, listRefs } from "../src/store/refs.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("refs", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("setRef creates a ref file and getRef reads it", () => {
    const hash = "a".repeat(64);
    setRef(dir, "HEAD", hash);
    expect(getRef(dir, hash)).toBe(hash);
  });

  it("getRef returns null for missing ref", () => {
    expect(getRef(dir, "HEAD")).toBeNull();
  });

  it("listRefs returns all refs", () => {
    setRef(dir, "HEAD", "a".repeat(64));
    setRef(dir, "latest-override", "b".repeat(64));
    const refs = listRefs(dir);
    expect(refs).toHaveLength(2);
    expect(refs.map((r) => r.name)).toContain("HEAD");
    expect(refs.map((r) => r.name)).toContain("latest-override");
  });

  it("listRefs returns empty array when no refs exist", () => {
    expect(listRefs(dir)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/store/refs.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/store/refs.ts
import { mkdirSync, writeFileSync, readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

function refsDir(storeDir: string): string {
  return join(storeDir, "refs");
}

export function setRef(storeDir: string, name: string, hash: string): void {
  const dir = refsDir(storeDir);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, name), hash);
}

export function getRef(storeDir: string, name: string): string | null {
  const path = join(refsDir(storeDir), name);
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf-8").trim();
}

export function listRefs(storeDir: string): Array<{ name: string; hash: string }> {
  const dir = refsDir(storeDir);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((name) => ({
    name,
    hash: readFileSync(join(dir, name), "utf-8").trim(),
  }));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/store/refs.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/store/refs.ts tests/store/refs.test.ts
git commit -m "feat(store): ref read/write/list"
```

---

## Task 5: Handprint Record Model

**Files:**
- Create: `src/model/handprint.ts`
- Create: `tests/model/handprint.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/model/handprint.test.ts
import { describe, it, expect } from "vitest";
import {
  createHandprint,
  validateHandprint,
  HandprintType,
  type Handprint,
} from "../src/model/handprint.js";

describe("Handprint model", () => {
  it("createHandprint builds a valid record with defaults", () => {
    const hp = createHandprint({
      type: HandprintType.Override,
      intent: "Edge JWT over centralized gateway",
      risk: "If compliance demands instant revocation we retrofit at cost",
      context: "auth-service-v2",
    });

    expect(hp.type).toBe("override");
    expect(hp.intent).toBe("Edge JWT over centralized gateway");
    expect(hp.risk).toBe("If compliance demands instant revocation we retrofit at cost");
    expect(hp.context).toBe("auth-service-v2");
    expect(hp.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(hp.author).toBeDefined();
    expect(hp.anchors).toEqual([]);
    expect(hp.horizon).toBeNull();
    expect(hp.confidence).toBeNull();
    expect(hp.source).toBeNull();
    expect(hp.status).toBe("open");
  });

  it("createHandprint accepts optional fields", () => {
    const hp = createHandprint({
      type: HandprintType.Wager,
      intent: "Token sizes stay under 4KB for 12 months",
      risk: "Growth exceeds prediction",
      context: "auth-service-v2",
      horizon: "P12M",
      confidence: 0.85,
      source: "cursor",
      anchors: [{ label: "git:3fa9e2d", verified: true }],
    });

    expect(hp.horizon).toBe("P12M");
    expect(hp.confidence).toBe(0.85);
    expect(hp.source).toBe("cursor");
    expect(hp.anchors).toHaveLength(1);
  });

  it("validateHandprint returns errors for missing required fields", () => {
    const invalid = { type: "override" } as unknown as Handprint;
    const errors = validateHandprint(invalid);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.includes("intent"))).toBe(true);
  });

  it("validateHandprint returns errors for invalid type", () => {
    const invalid = createHandprint({
      type: "banana" as HandprintType,
      intent: "test",
      risk: "test",
      context: "test",
    });
    const errors = validateHandprint(invalid);
    expect(errors.some((e) => e.includes("type"))).toBe(true);
  });

  it("validateHandprint returns empty array for valid handprint", () => {
    const hp = createHandprint({
      type: HandprintType.Constraint,
      intent: "No third-party auth in billing",
      risk: "Must maintain our own auth layer",
      context: "billing-service",
    });
    expect(validateHandprint(hp)).toEqual([]);
  });

  it("all five HandprintType values are defined", () => {
    expect(HandprintType.Direction).toBe("direction");
    expect(HandprintType.Override).toBe("override");
    expect(HandprintType.Rejection).toBe("rejection");
    expect(HandprintType.Constraint).toBe("constraint");
    expect(HandprintType.Wager).toBe("wager");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/model/handprint.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/model/handprint.ts
export enum HandprintType {
  Direction = "direction",
  Override = "override",
  Rejection = "rejection",
  Constraint = "constraint",
  Wager = "wager",
}

const VALID_TYPES = new Set(Object.values(HandprintType));

export interface Anchor {
  label: string;
  verified: boolean;
}

export interface Handprint {
  type: HandprintType;
  intent: string;
  risk: string;
  context: string;
  timestamp: string;
  author: string;
  horizon: string | null;
  confidence: number | null;
  source: string | null;
  anchors: Anchor[];
  status: "open" | "resolved";
}

interface CreateHandprintInput {
  type: HandprintType;
  intent: string;
  risk: string;
  context: string;
  horizon?: string;
  confidence?: number;
  source?: string;
  anchors?: Anchor[];
  author?: string;
}

export function createHandprint(input: CreateHandprintInput): Handprint {
  return {
    type: input.type,
    intent: input.intent,
    risk: input.risk,
    context: input.context,
    timestamp: new Date().toISOString(),
    author: input.author ?? currentAuthor(),
    horizon: input.horizon ?? null,
    confidence: input.confidence ?? null,
    source: input.source ?? null,
    anchors: input.anchors ?? [],
    status: "open",
  };
}

export function validateHandprint(hp: Handprint): string[] {
  const errors: string[] = [];
  if (!hp.type || !VALID_TYPES.has(hp.type)) {
    errors.push(`invalid type: "${hp.type}" — must be one of: ${[...VALID_TYPES].join(", ")}`);
  }
  if (!hp.intent) errors.push("missing required field: intent");
  if (!hp.risk) errors.push("missing required field: risk");
  if (!hp.context) errors.push("missing required field: context");
  if (!hp.timestamp) errors.push("missing required field: timestamp");
  return errors;
}

function currentAuthor(): string {
  try {
    const { execSync } = require("node:child_process");
    const name = execSync("git config user.name", { encoding: "utf-8" }).trim();
    const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
    return `${name} <${email}>`;
  } catch {
    return "unknown";
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/model/handprint.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/model/handprint.ts tests/model/handprint.test.ts
git commit -m "feat(model): handprint record type, creation, validation"
```

---

## Task 6: Resolution Record Model

**Files:**
- Create: `src/model/resolution.ts`
- Create: `tests/model/resolution.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/model/resolution.test.ts
import { describe, it, expect } from "vitest";
import {
  createResolution,
  validateResolution,
  ResolutionStatus,
  type Resolution,
} from "../src/model/resolution.js";

describe("Resolution model", () => {
  it("createResolution builds a valid record", () => {
    const res = createResolution({
      handprintHash: "a".repeat(64),
      status: ResolutionStatus.Validated,
      body: "Right call. Eliminated 94% of duplicate charges.",
      learnings: ["observability-before-optimization"],
    });

    expect(res.handprintHash).toBe("a".repeat(64));
    expect(res.status).toBe("validated");
    expect(res.body).toContain("94%");
    expect(res.learnings).toHaveLength(1);
    expect(res.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("all four ResolutionStatus values are defined", () => {
    expect(ResolutionStatus.Validated).toBe("validated");
    expect(ResolutionStatus.Partial).toBe("partial");
    expect(ResolutionStatus.Revised).toBe("revised");
    expect(ResolutionStatus.Invalidated).toBe("invalidated");
  });

  it("validateResolution returns errors for missing fields", () => {
    const invalid = { status: "validated" } as unknown as Resolution;
    const errors = validateResolution(invalid);
    expect(errors.some((e) => e.includes("handprintHash"))).toBe(true);
    expect(errors.some((e) => e.includes("body"))).toBe(true);
  });

  it("validateResolution rejects invalid status", () => {
    const invalid = createResolution({
      handprintHash: "a".repeat(64),
      status: "great" as ResolutionStatus,
      body: "test",
    });
    const errors = validateResolution(invalid);
    expect(errors.some((e) => e.includes("status"))).toBe(true);
  });

  it("validateResolution returns empty for valid resolution", () => {
    const res = createResolution({
      handprintHash: "a".repeat(64),
      status: ResolutionStatus.Partial,
      body: "Partially correct.",
    });
    expect(validateResolution(res)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/model/resolution.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/model/resolution.ts
export enum ResolutionStatus {
  Validated = "validated",
  Partial = "partial",
  Revised = "revised",
  Invalidated = "invalidated",
}

const VALID_STATUSES = new Set(Object.values(ResolutionStatus));

export interface Resolution {
  handprintHash: string;
  status: ResolutionStatus;
  body: string;
  learnings: string[];
  timestamp: string;
  author: string;
}

interface CreateResolutionInput {
  handprintHash: string;
  status: ResolutionStatus;
  body: string;
  learnings?: string[];
  author?: string;
}

export function createResolution(input: CreateResolutionInput): Resolution {
  return {
    handprintHash: input.handprintHash,
    status: input.status,
    body: input.body,
    learnings: input.learnings ?? [],
    timestamp: new Date().toISOString(),
    author: input.author ?? "unknown",
  };
}

export function validateResolution(res: Resolution): string[] {
  const errors: string[] = [];
  if (!res.handprintHash) errors.push("missing required field: handprintHash");
  if (!res.status || !VALID_STATUSES.has(res.status)) {
    errors.push(`invalid status: "${res.status}" — must be one of: ${[...VALID_STATUSES].join(", ")}`);
  }
  if (!res.body) errors.push("missing required field: body");
  return errors;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/model/resolution.test.ts`
Expected: 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/model/resolution.ts tests/model/resolution.test.ts
git commit -m "feat(model): resolution record type, creation, validation"
```

---

## Task 7: `handprint init` Command

**Files:**
- Create: `src/commands/init.ts`
- Create: `tests/commands/init.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/init.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initStore, HANDPRINT_DIR } from "../src/commands/init.js";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("handprint init", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates .handprint/ with objects/, refs/, staging/ subdirs", () => {
    initStore(dir);
    const hp = join(dir, HANDPRINT_DIR);
    expect(existsSync(join(hp, "objects"))).toBe(true);
    expect(existsSync(join(hp, "refs"))).toBe(true);
    expect(existsSync(join(hp, "staging"))).toBe(true);
  });

  it("creates a config file with version", () => {
    initStore(dir);
    const config = JSON.parse(
      readFileSync(join(dir, HANDPRINT_DIR, "config.json"), "utf-8")
    );
    expect(config.version).toBe("0.1.0");
    expect(config.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("refuses to init if .handprint/ already exists", () => {
    initStore(dir);
    expect(() => initStore(dir)).toThrow("already initialized");
  });

  it("returns the path to the .handprint/ directory", () => {
    const result = initStore(dir);
    expect(result).toBe(join(dir, HANDPRINT_DIR));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/init.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/commands/init.ts
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export const HANDPRINT_DIR = ".handprint";

export function initStore(repoRoot: string): string {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (existsSync(hpDir)) {
    throw new Error(`already initialized: ${hpDir}`);
  }

  mkdirSync(join(hpDir, "objects"), { recursive: true });
  mkdirSync(join(hpDir, "refs"), { recursive: true });
  mkdirSync(join(hpDir, "staging"), { recursive: true });

  writeFileSync(
    join(hpDir, "config.json"),
    JSON.stringify(
      {
        version: "0.1.0",
        createdAt: new Date().toISOString(),
      },
      null,
      2
    )
  );

  return hpDir;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/commands/init.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/init.ts tests/commands/init.test.ts
git commit -m "feat(commands): handprint init creates .handprint/ structure"
```

---

## Task 8: `handprint seal` Command

**Files:**
- Create: `src/commands/seal.ts`
- Create: `tests/commands/seal.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/seal.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { sealHandprint } from "../src/commands/seal.js";
import { initStore } from "../src/commands/init.js";
import { readObject } from "../src/store/objects.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HandprintType } from "../src/model/handprint.js";

describe("handprint seal", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    initStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("seals a handprint and returns its hash", () => {
    const hash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT over gateway",
      risk: "Revocation gap",
      context: "auth-v2",
    });
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("persists the handprint to the object store", () => {
    const hash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT over gateway",
      risk: "Revocation gap",
      context: "auth-v2",
    });
    const obj = readObject(join(dir, ".handprint"), hash);
    expect(obj).not.toBeNull();
    expect((obj as Record<string, unknown>).intent).toBe("Edge JWT over gateway");
  });

  it("appends hash to the log index", () => {
    const { readFileSync } = await import("node:fs");
    const h1 = sealHandprint(dir, {
      type: HandprintType.Constraint,
      intent: "No vendor auth in billing",
      risk: "Maintenance cost",
      context: "billing",
    });
    const h2 = sealHandprint(dir, {
      type: HandprintType.Wager,
      intent: "Token sizes under 4KB",
      risk: "Growth exceeds model",
      context: "auth-v2",
    });
    const log = readFileSync(join(dir, ".handprint", "log"), "utf-8").trim().split("\n");
    expect(log).toHaveLength(2);
    expect(log[0]).toBe(h1);
    expect(log[1]).toBe(h2);
  });

  it("throws if .handprint/ does not exist", () => {
    const emptyDir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    expect(() =>
      sealHandprint(emptyDir, {
        type: HandprintType.Override,
        intent: "test",
        risk: "test",
        context: "test",
      })
    ).toThrow("not initialized");
    rmSync(emptyDir, { recursive: true, force: true });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/seal.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/commands/seal.ts
import { appendFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { writeObject } from "../store/objects.js";
import { createHandprint, type Handprint, type HandprintType } from "../model/handprint.js";
import { HANDPRINT_DIR } from "./init.js";

interface SealInput {
  type: HandprintType;
  intent: string;
  risk: string;
  context: string;
  horizon?: string;
  confidence?: number;
  source?: string;
  anchors?: Array<{ label: string; verified: boolean }>;
}

export function sealHandprint(repoRoot: string, input: SealInput): string {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  if (!existsSync(hpDir)) {
    throw new Error(`not initialized: run 'handprint init' first`);
  }

  const hp = createHandprint(input);
  const hash = writeObject(hpDir, hp as unknown as Record<string, unknown>);
  appendFileSync(join(hpDir, "log"), hash + "\n");
  return hash;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/commands/seal.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/seal.ts tests/commands/seal.test.ts
git commit -m "feat(commands): handprint seal writes immutable record"
```

---

## Task 9: `handprint log` Command

**Files:**
- Create: `src/commands/log.ts`
- Create: `tests/commands/log.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/log.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { listHandprints } from "../src/commands/log.js";
import { sealHandprint } from "../src/commands/seal.js";
import { initStore } from "../src/commands/init.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HandprintType } from "../src/model/handprint.js";

describe("handprint log", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    initStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns empty array when no handprints exist", () => {
    expect(listHandprints(dir)).toEqual([]);
  });

  it("returns all sealed handprints in order", () => {
    sealHandprint(dir, { type: HandprintType.Override, intent: "first", risk: "r", context: "c" });
    sealHandprint(dir, { type: HandprintType.Constraint, intent: "second", risk: "r", context: "c" });
    const results = listHandprints(dir);
    expect(results).toHaveLength(2);
    expect(results[0].intent).toBe("first");
    expect(results[1].intent).toBe("second");
  });

  it("each entry includes its hash", () => {
    sealHandprint(dir, { type: HandprintType.Wager, intent: "test", risk: "r", context: "c" });
    const results = listHandprints(dir);
    expect(results[0].hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("filters by type", () => {
    sealHandprint(dir, { type: HandprintType.Override, intent: "a", risk: "r", context: "c" });
    sealHandprint(dir, { type: HandprintType.Constraint, intent: "b", risk: "r", context: "c" });
    sealHandprint(dir, { type: HandprintType.Override, intent: "c", risk: "r", context: "c" });
    const overrides = listHandprints(dir, { type: HandprintType.Override });
    expect(overrides).toHaveLength(2);
    expect(overrides.every((h) => h.type === "override")).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/log.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/commands/log.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Handprint, HandprintType } from "../model/handprint.js";

export interface HandprintEntry extends Handprint {
  hash: string;
}

interface ListOptions {
  type?: HandprintType;
}

export function listHandprints(repoRoot: string, options?: ListOptions): HandprintEntry[] {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const logPath = join(hpDir, "log");

  if (!existsSync(logPath)) return [];

  const hashes = readFileSync(logPath, "utf-8").trim().split("\n").filter(Boolean);
  let entries: HandprintEntry[] = hashes
    .map((hash) => {
      const obj = readObject(hpDir, hash);
      if (!obj) return null;
      return { ...(obj as unknown as Handprint), hash };
    })
    .filter((e): e is HandprintEntry => e !== null);

  if (options?.type) {
    entries = entries.filter((e) => e.type === options.type);
  }

  return entries;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/commands/log.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/log.ts tests/commands/log.test.ts
git commit -m "feat(commands): handprint log with type filtering"
```

---

## Task 10: `handprint show` Command

**Files:**
- Create: `src/commands/show.ts`
- Create: `tests/commands/show.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/show.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { showHandprint } from "../src/commands/show.js";
import { sealHandprint } from "../src/commands/seal.js";
import { initStore } from "../src/commands/init.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HandprintType } from "../src/model/handprint.js";

describe("handprint show", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    initStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns full handprint by hash", () => {
    const hash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT",
      risk: "Revocation",
      context: "auth-v2",
    });
    const result = showHandprint(dir, hash);
    expect(result).not.toBeNull();
    expect(result!.intent).toBe("Edge JWT");
    expect(result!.hash).toBe(hash);
  });

  it("resolves short hash prefix (min 7 chars)", () => {
    const hash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT",
      risk: "Revocation",
      context: "auth-v2",
    });
    const result = showHandprint(dir, hash.slice(0, 7));
    expect(result).not.toBeNull();
    expect(result!.hash).toBe(hash);
  });

  it("returns null for unknown hash", () => {
    const result = showHandprint(dir, "0".repeat(64));
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/show.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/commands/show.ts
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Handprint } from "../model/handprint.js";

export interface HandprintDetail extends Handprint {
  hash: string;
}

function resolvePrefix(hpDir: string, prefix: string): string | null {
  if (prefix.length >= 64) {
    return readObject(hpDir, prefix) ? prefix : null;
  }
  if (prefix.length < 7) return null;

  const bucketDir = join(hpDir, "objects", prefix.slice(0, 2));
  if (!existsSync(bucketDir)) return null;

  const suffix = prefix.slice(2);
  const matches = readdirSync(bucketDir).filter((f) => f.startsWith(suffix));
  if (matches.length === 1) return prefix.slice(0, 2) + matches[0];
  return null;
}

export function showHandprint(repoRoot: string, ref: string): HandprintDetail | null {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const hash = resolvePrefix(hpDir, ref);
  if (!hash) return null;

  const obj = readObject(hpDir, hash);
  if (!obj) return null;

  return { ...(obj as unknown as Handprint), hash };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/commands/show.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/show.ts tests/commands/show.test.ts
git commit -m "feat(commands): handprint show with short-hash resolution"
```

---

## Task 11: `handprint resolve` Command

**Files:**
- Create: `src/commands/resolve.ts`
- Create: `tests/commands/resolve.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/resolve.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resolveHandprint } from "../src/commands/resolve.js";
import { sealHandprint } from "../src/commands/seal.js";
import { showHandprint } from "../src/commands/show.js";
import { initStore } from "../src/commands/init.js";
import { readObject } from "../src/store/objects.js";
import { mkdtempSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HandprintType } from "../src/model/handprint.js";
import { ResolutionStatus } from "../src/model/resolution.js";

describe("handprint resolve", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    initStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("creates a resolution object linked to the handprint", () => {
    const hpHash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT",
      risk: "Revocation",
      context: "auth-v2",
    });

    const resHash = resolveHandprint(dir, {
      handprintRef: hpHash,
      status: ResolutionStatus.Validated,
      body: "Right call. 94% reduction.",
    });

    expect(resHash).toMatch(/^[a-f0-9]{64}$/);
    const obj = readObject(join(dir, ".handprint"), resHash);
    expect(obj).not.toBeNull();
    expect((obj as Record<string, unknown>).handprintHash).toBe(hpHash);
  });

  it("updates the handprint status to resolved", () => {
    const hpHash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT",
      risk: "Revocation",
      context: "auth-v2",
    });

    resolveHandprint(dir, {
      handprintRef: hpHash,
      status: ResolutionStatus.Validated,
      body: "Confirmed.",
    });

    const hp = showHandprint(dir, hpHash);
    expect(hp!.status).toBe("resolved");
  });

  it("writes resolution hash to resolutions index", () => {
    const hpHash = sealHandprint(dir, {
      type: HandprintType.Override,
      intent: "Edge JWT",
      risk: "Revocation",
      context: "auth-v2",
    });

    const resHash = resolveHandprint(dir, {
      handprintRef: hpHash,
      status: ResolutionStatus.Invalidated,
      body: "Wrong call.",
      learnings: ["lesson-learned"],
    });

    const index = readFileSync(
      join(dir, ".handprint", "resolutions"),
      "utf-8"
    ).trim();
    expect(index).toContain(resHash);
  });

  it("throws for unknown handprint ref", () => {
    expect(() =>
      resolveHandprint(dir, {
        handprintRef: "0".repeat(64),
        status: ResolutionStatus.Validated,
        body: "test",
      })
    ).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/resolve.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/commands/resolve.ts
import { appendFileSync, existsSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { writeObject, readObject } from "../store/objects.js";
import { showHandprint } from "./show.js";
import { createResolution, type ResolutionStatus } from "../model/resolution.js";
import { HANDPRINT_DIR } from "./init.js";

interface ResolveInput {
  handprintRef: string;
  status: ResolutionStatus;
  body: string;
  learnings?: string[];
}

export function resolveHandprint(repoRoot: string, input: ResolveInput): string {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const hp = showHandprint(repoRoot, input.handprintRef);
  if (!hp) {
    throw new Error(`handprint not found: ${input.handprintRef}`);
  }

  const resolution = createResolution({
    handprintHash: hp.hash,
    status: input.status,
    body: input.body,
    learnings: input.learnings,
  });

  const resHash = writeObject(hpDir, resolution as unknown as Record<string, unknown>);
  appendFileSync(join(hpDir, "resolutions"), resHash + "\n");

  // Update the handprint's status in-place (rewrite the object)
  const hpObj = readObject(hpDir, hp.hash) as Record<string, unknown>;
  hpObj.status = "resolved";
  const hpPath = join(hpDir, "objects", hp.hash.slice(0, 2), hp.hash.slice(2));
  writeFileSync(hpPath, JSON.stringify(hpObj, null, 2));

  return resHash;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/commands/resolve.test.ts`
Expected: 4 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/resolve.ts tests/commands/resolve.test.ts
git commit -m "feat(commands): handprint resolve with status update"
```

---

## Task 12: `handprint export` Command

**Files:**
- Create: `src/commands/export.ts`
- Create: `tests/commands/export.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/commands/export.test.ts
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exportHandprints } from "../src/commands/export.js";
import { sealHandprint } from "../src/commands/seal.js";
import { resolveHandprint } from "../src/commands/resolve.js";
import { initStore } from "../src/commands/init.js";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { HandprintType } from "../src/model/handprint.js";
import { ResolutionStatus } from "../src/model/resolution.js";

describe("handprint export", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "handprint-test-"));
    initStore(dir);
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it("exports all handprints as JSON", () => {
    sealHandprint(dir, { type: HandprintType.Override, intent: "a", risk: "r", context: "c" });
    sealHandprint(dir, { type: HandprintType.Constraint, intent: "b", risk: "r", context: "c" });
    const json = exportHandprints(dir);
    expect(json.handprints).toHaveLength(2);
    expect(json.version).toBe("0.1.0");
  });

  it("includes resolutions linked to their handprints", () => {
    const hash = sealHandprint(dir, {
      type: HandprintType.Wager,
      intent: "tokens under 4KB",
      risk: "growth",
      context: "auth-v2",
    });
    resolveHandprint(dir, {
      handprintRef: hash,
      status: ResolutionStatus.Validated,
      body: "Confirmed.",
    });
    const json = exportHandprints(dir);
    expect(json.handprints[0].resolutions).toHaveLength(1);
    expect(json.handprints[0].resolutions[0].status).toBe("validated");
  });

  it("returns empty handprints array when none exist", () => {
    const json = exportHandprints(dir);
    expect(json.handprints).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/commands/export.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/commands/export.ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { readObject } from "../store/objects.js";
import { listHandprints } from "./log.js";
import { HANDPRINT_DIR } from "./init.js";
import type { Resolution } from "../model/resolution.js";

interface ExportedHandprint {
  hash: string;
  [key: string]: unknown;
  resolutions: Resolution[];
}

interface ExportResult {
  version: string;
  exportedAt: string;
  handprints: ExportedHandprint[];
}

export function exportHandprints(repoRoot: string): ExportResult {
  const hpDir = join(repoRoot, HANDPRINT_DIR);
  const entries = listHandprints(repoRoot);

  const resolutionHashes = loadResolutionHashes(hpDir);
  const resolutions = resolutionHashes
    .map((h) => readObject(hpDir, h))
    .filter((r): r is Record<string, unknown> => r !== null);

  const handprints: ExportedHandprint[] = entries.map((entry) => {
    const linked = resolutions.filter(
      (r) => r.handprintHash === entry.hash
    ) as unknown as Resolution[];
    return { ...entry, resolutions: linked };
  });

  return {
    version: "0.1.0",
    exportedAt: new Date().toISOString(),
    handprints,
  };
}

function loadResolutionHashes(hpDir: string): string[] {
  const path = join(hpDir, "resolutions");
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf-8").trim().split("\n").filter(Boolean);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/commands/export.test.ts`
Expected: 3 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/commands/export.ts tests/commands/export.test.ts
git commit -m "feat(commands): handprint export with linked resolutions"
```

---

## Task 13: CLI Entry Point (Commander.js wiring)

**Files:**
- Create: `bin/handprint.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Write src/index.ts re-exports**

```typescript
// src/index.ts
export { initStore, HANDPRINT_DIR } from "./commands/init.js";
export { sealHandprint } from "./commands/seal.js";
export { listHandprints } from "./commands/log.js";
export { showHandprint } from "./commands/show.js";
export { resolveHandprint } from "./commands/resolve.js";
export { exportHandprints } from "./commands/export.js";
export { HandprintType } from "./model/handprint.js";
export { ResolutionStatus } from "./model/resolution.js";
```

- [ ] **Step 2: Write the CLI entry point**

```typescript
#!/usr/bin/env npx tsx
// bin/handprint.ts
import { Command } from "commander";
import {
  initStore,
  sealHandprint,
  listHandprints,
  showHandprint,
  resolveHandprint,
  exportHandprints,
  HandprintType,
  ResolutionStatus,
} from "../src/index.js";

const program = new Command();
program.name("handprint").description("Human decision provenance for the age of AI").version("0.1.0");

program
  .command("init")
  .description("Initialize .handprint/ in the current repo")
  .action(() => {
    try {
      const path = initStore(process.cwd());
      console.log(`initialized ${path}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command("seal")
  .description("Seal a new handprint")
  .requiredOption("-t, --type <type>", "direction | override | rejection | constraint | wager")
  .requiredOption("-i, --intent <intent>", "What you decided and why")
  .requiredOption("-r, --risk <risk>", "What could go wrong")
  .requiredOption("-c, --context <context>", "Project or domain context")
  .option("-h, --horizon <horizon>", "ISO 8601 duration (e.g. P12M)")
  .option("--confidence <n>", "Confidence 0-1", parseFloat)
  .option("-s, --source <source>", "Tool source (cursor, claude, terminal)")
  .action((opts) => {
    try {
      const hash = sealHandprint(process.cwd(), {
        type: opts.type as HandprintType,
        intent: opts.intent,
        risk: opts.risk,
        context: opts.context,
        horizon: opts.horizon,
        confidence: opts.confidence,
        source: opts.source,
      });
      console.log(`sealed ${hash.slice(0, 12)}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command("log")
  .description("List sealed handprints")
  .option("-t, --type <type>", "Filter by type")
  .action((opts) => {
    const entries = listHandprints(process.cwd(), {
      type: opts.type as HandprintType | undefined,
    });
    if (entries.length === 0) {
      console.log("no handprints yet");
      return;
    }
    for (const e of entries) {
      const short = e.hash.slice(0, 10);
      const ts = e.timestamp.slice(0, 10);
      console.log(`${short}  ${e.type.padEnd(11)} ${ts}  ${e.intent}`);
    }
  });

program
  .command("show <ref>")
  .description("Show a handprint by hash (or prefix)")
  .action((ref) => {
    const hp = showHandprint(process.cwd(), ref);
    if (!hp) {
      console.error(`not found: ${ref}`);
      process.exit(1);
    }
    console.log(JSON.stringify(hp, null, 2));
  });

program
  .command("resolve <ref>")
  .description("Resolve a handprint")
  .requiredOption("-s, --status <status>", "validated | partial | revised | invalidated")
  .requiredOption("-b, --body <body>", "Resolution explanation")
  .option("-l, --learnings <items>", "Comma-separated learnings", (v: string) => v.split(","))
  .action((ref, opts) => {
    try {
      const hash = resolveHandprint(process.cwd(), {
        handprintRef: ref,
        status: opts.status as ResolutionStatus,
        body: opts.body,
        learnings: opts.learnings,
      });
      console.log(`resolved → ${hash.slice(0, 12)}`);
    } catch (e) {
      console.error((e as Error).message);
      process.exit(1);
    }
  });

program
  .command("export")
  .description("Export all handprints as JSON")
  .action(() => {
    const result = exportHandprints(process.cwd());
    console.log(JSON.stringify(result, null, 2));
  });

program.parse();
```

- [ ] **Step 3: Verify CLI runs**

Run: `cd ~/handprint && npx tsx bin/handprint.ts --help`
Expected: Shows help text with all commands listed

- [ ] **Step 4: Commit**

```bash
git add bin/handprint.ts src/index.ts
git commit -m "feat(cli): wire all commands into Commander.js entry point"
```

---

## Task 14: Git History Scanner

**Files:**
- Create: `src/scanner/git.ts`
- Create: `tests/scanner/git.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/scanner/git.test.ts
import { describe, it, expect } from "vitest";
import { parseGitLog, classifyCommit, type GitCommit } from "../src/scanner/git.js";

describe("git scanner", () => {
  describe("parseGitLog", () => {
    it("parses git log --format output into structured commits", () => {
      const raw = [
        "abc1234|2026-06-01T10:00:00Z|Cameron Whiteside|feat: edge JWT middleware",
        "def5678|2026-06-01T09:00:00Z|Cameron Whiteside|fix: remove vendor auth from billing",
      ].join("\n");

      const commits = parseGitLog(raw);
      expect(commits).toHaveLength(2);
      expect(commits[0].hash).toBe("abc1234");
      expect(commits[0].message).toBe("feat: edge JWT middleware");
      expect(commits[0].author).toBe("Cameron Whiteside");
    });

    it("handles empty input", () => {
      expect(parseGitLog("")).toEqual([]);
      expect(parseGitLog("\n")).toEqual([]);
    });
  });

  describe("classifyCommit", () => {
    it("detects override signals", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "feat: use edge JWT instead of centralized gateway",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("override");
    });

    it("detects rejection signals", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "chore: remove recommendations engine — not ready for v2",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("rejection");
    });

    it("detects constraint signals", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "fix: enforce no third-party auth in billing path",
      };
      const result = classifyCommit(commit);
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("constraint");
    });

    it("returns null for routine commits", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "chore: update dependencies",
      };
      expect(classifyCommit(commit)).toBeNull();
    });

    it("returns null for merge commits", () => {
      const commit: GitCommit = {
        hash: "abc",
        timestamp: "2026-06-01",
        author: "Test",
        message: "Merge branch 'main' into feature",
      };
      expect(classifyCommit(commit)).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/scanner/git.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/scanner/git.ts
export interface GitCommit {
  hash: string;
  timestamp: string;
  author: string;
  message: string;
}

export interface ScanCandidate {
  commit: GitCommit;
  suggestedType: string;
  signals: string[];
}

export function parseGitLog(raw: string): GitCommit[] {
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [hash, timestamp, author, ...msgParts] = line.split("|");
      return { hash, timestamp, author, message: msgParts.join("|") };
    });
}

const OVERRIDE_PATTERNS = [
  /instead of/i,
  /over (?:the|a) /i,
  /rather than/i,
  /replacing/i,
  /switch(?:ing|ed)? (?:from|to)/i,
  /chose .+ over/i,
];

const REJECTION_PATTERNS = [
  /remov(?:e|ing|ed)/i,
  /declin(?:e|ing|ed)/i,
  /not ready/i,
  /drop(?:ping|ped)?/i,
  /won't|will not/i,
  /rip(?:ping|ped)? out/i,
];

const CONSTRAINT_PATTERNS = [
  /enforce/i,
  /never|always/i,
  /must not|cannot/i,
  /no .+ in .+ path/i,
  /boundary|guardrail/i,
  /cap(?:ped)? at/i,
];

const SKIP_PATTERNS = [
  /^merge /i,
  /^chore: (?:update|bump|upgrade) dep/i,
  /^ci:/i,
  /^docs:/i,
  /^style:/i,
];

export function classifyCommit(commit: GitCommit): ScanCandidate | null {
  const msg = commit.message;

  if (SKIP_PATTERNS.some((p) => p.test(msg))) return null;

  const signals: string[] = [];
  let suggestedType: string | null = null;

  for (const p of OVERRIDE_PATTERNS) {
    if (p.test(msg)) {
      signals.push(`override: ${p.source}`);
      suggestedType = suggestedType ?? "override";
    }
  }
  for (const p of REJECTION_PATTERNS) {
    if (p.test(msg)) {
      signals.push(`rejection: ${p.source}`);
      suggestedType = suggestedType ?? "rejection";
    }
  }
  for (const p of CONSTRAINT_PATTERNS) {
    if (p.test(msg)) {
      signals.push(`constraint: ${p.source}`);
      suggestedType = suggestedType ?? "constraint";
    }
  }

  if (!suggestedType) return null;

  return { commit, suggestedType, signals };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/scanner/git.test.ts`
Expected: 7 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/scanner/git.ts tests/scanner/git.test.ts
git commit -m "feat(scanner): git log parser and heuristic commit classifier"
```

---

## Task 15: Claude Code Transcript Scanner

**Files:**
- Create: `src/scanner/claude-code.ts`
- Create: `tests/scanner/claude-code.test.ts`

The Claude Code transcript format (from `~/.claude/projects/` JSONL files):
- `type: "user"` entries have `message.content` (string or array) with the user's input
- `type: "assistant"` entries have `message.content` array with `type: "text"` blocks
- Each entry has `timestamp`, `cwd`, `sessionId`, `gitBranch`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/scanner/claude-code.test.ts
import { describe, it, expect } from "vitest";
import {
  parseTranscriptLine,
  extractConversationPairs,
  classifyPair,
  type TranscriptEntry,
} from "../src/scanner/claude-code.js";

describe("Claude Code transcript scanner", () => {
  describe("parseTranscriptLine", () => {
    it("parses a user message line", () => {
      const line = JSON.stringify({
        type: "user",
        message: { role: "user", content: "use edge JWT instead of the gateway" },
        timestamp: "2026-06-01T10:00:00Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
        gitBranch: "main",
      });
      const entry = parseTranscriptLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.role).toBe("user");
      expect(entry!.text).toContain("edge JWT");
    });

    it("parses an assistant message line", () => {
      const line = JSON.stringify({
        type: "assistant",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "I'll implement the edge JWT approach." }],
        },
        timestamp: "2026-06-01T10:00:01Z",
        cwd: "/Users/test/project",
        sessionId: "abc-123",
      });
      const entry = parseTranscriptLine(line);
      expect(entry).not.toBeNull();
      expect(entry!.role).toBe("assistant");
      expect(entry!.text).toContain("edge JWT");
    });

    it("returns null for non-message types", () => {
      const line = JSON.stringify({ type: "mode", mode: "normal" });
      expect(parseTranscriptLine(line)).toBeNull();
    });
  });

  describe("extractConversationPairs", () => {
    it("pairs user messages with following assistant messages", () => {
      const entries: TranscriptEntry[] = [
        { role: "user", text: "do X instead of Y", timestamp: "2026-06-01T10:00:00Z", cwd: "/test", sessionId: "s1" },
        { role: "assistant", text: "OK, implementing X.", timestamp: "2026-06-01T10:00:01Z", cwd: "/test", sessionId: "s1" },
        { role: "user", text: "never use vendor auth", timestamp: "2026-06-01T10:01:00Z", cwd: "/test", sessionId: "s1" },
        { role: "assistant", text: "Understood, adding constraint.", timestamp: "2026-06-01T10:01:01Z", cwd: "/test", sessionId: "s1" },
      ];
      const pairs = extractConversationPairs(entries);
      expect(pairs).toHaveLength(2);
      expect(pairs[0].user.text).toContain("do X");
      expect(pairs[0].assistant.text).toContain("implementing X");
    });
  });

  describe("classifyPair", () => {
    it("detects override when user chooses an alternative", () => {
      const result = classifyPair({
        user: { role: "user", text: "no, use edge JWT instead of the centralized gateway", timestamp: "t", cwd: "/c", sessionId: "s" },
        assistant: { role: "assistant", text: "Switching to edge JWT approach.", timestamp: "t", cwd: "/c", sessionId: "s" },
      });
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("override");
    });

    it("detects rejection when user declines", () => {
      const result = classifyPair({
        user: { role: "user", text: "we're not building the recommendations engine, skip that", timestamp: "t", cwd: "/c", sessionId: "s" },
        assistant: { role: "assistant", text: "OK, removing recs engine.", timestamp: "t", cwd: "/c", sessionId: "s" },
      });
      expect(result).not.toBeNull();
      expect(result!.suggestedType).toBe("rejection");
    });

    it("returns null for routine exchanges", () => {
      const result = classifyPair({
        user: { role: "user", text: "format the code", timestamp: "t", cwd: "/c", sessionId: "s" },
        assistant: { role: "assistant", text: "Done, formatted.", timestamp: "t", cwd: "/c", sessionId: "s" },
      });
      expect(result).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd ~/handprint && npx vitest run tests/scanner/claude-code.test.ts`
Expected: FAIL — cannot find module

- [ ] **Step 3: Write minimal implementation**

```typescript
// src/scanner/claude-code.ts
export interface TranscriptEntry {
  role: "user" | "assistant";
  text: string;
  timestamp: string;
  cwd: string;
  sessionId: string;
}

export interface ConversationPair {
  user: TranscriptEntry;
  assistant: TranscriptEntry;
}

export interface TranscriptCandidate {
  pair: ConversationPair;
  suggestedType: string;
  signals: string[];
}

export function parseTranscriptLine(line: string): TranscriptEntry | null {
  try {
    const data = JSON.parse(line);
    if (data.type === "user" && data.message?.role === "user") {
      const text =
        typeof data.message.content === "string"
          ? data.message.content
          : Array.isArray(data.message.content)
            ? data.message.content
                .filter((c: { type: string }) => c.type === "text")
                .map((c: { text: string }) => c.text)
                .join(" ")
            : "";
      if (!text) return null;
      return {
        role: "user",
        text,
        timestamp: data.timestamp ?? "",
        cwd: data.cwd ?? "",
        sessionId: data.sessionId ?? "",
      };
    }
    if (data.type === "assistant" && data.message?.role === "assistant") {
      const content = data.message.content;
      const text = Array.isArray(content)
        ? content
            .filter((c: { type: string }) => c.type === "text")
            .map((c: { text: string }) => c.text)
            .join(" ")
        : typeof content === "string"
          ? content
          : "";
      if (!text) return null;
      return {
        role: "assistant",
        text,
        timestamp: data.timestamp ?? "",
        cwd: data.cwd ?? "",
        sessionId: data.sessionId ?? "",
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractConversationPairs(entries: TranscriptEntry[]): ConversationPair[] {
  const pairs: ConversationPair[] = [];
  for (let i = 0; i < entries.length - 1; i++) {
    if (entries[i].role === "user" && entries[i + 1].role === "assistant") {
      pairs.push({ user: entries[i], assistant: entries[i + 1] });
    }
  }
  return pairs;
}

const OVERRIDE_SIGNALS = [
  /instead/i,
  /no,? (?:use|do|go with|switch)/i,
  /not that/i,
  /rather than/i,
  /\bover\b.+\bover\b/i,
  /I(?:'d| would) prefer/i,
  /let's go with/i,
  /actually,? (?:use|do|let)/i,
];

const REJECTION_SIGNALS = [
  /(?:don't|do not|skip|remove|drop) (?:that|this|the)/i,
  /we(?:'re| are) not (?:building|doing|adding)/i,
  /off the table/i,
  /out of scope/i,
  /not (?:ready|worth|needed)/i,
  /decline/i,
];

const CONSTRAINT_SIGNALS = [
  /never|always/i,
  /must not|cannot|can't/i,
  /(?:hard|strict) (?:rule|constraint|requirement)/i,
  /non-negotiable/i,
  /boundary/i,
];

const WAGER_SIGNALS = [
  /I (?:bet|predict|think|expect) .+ will/i,
  /betting (?:that|on)/i,
  /within \d+ months/i,
  /by (?:Q[1-4]|next|end of)/i,
];

export function classifyPair(pair: ConversationPair): TranscriptCandidate | null {
  const text = pair.user.text;
  const signals: string[] = [];
  let suggestedType: string | null = null;

  for (const p of OVERRIDE_SIGNALS) {
    if (p.test(text)) {
      signals.push(`override: ${p.source}`);
      suggestedType = suggestedType ?? "override";
    }
  }
  for (const p of REJECTION_SIGNALS) {
    if (p.test(text)) {
      signals.push(`rejection: ${p.source}`);
      suggestedType = suggestedType ?? "rejection";
    }
  }
  for (const p of CONSTRAINT_SIGNALS) {
    if (p.test(text)) {
      signals.push(`constraint: ${p.source}`);
      suggestedType = suggestedType ?? "constraint";
    }
  }
  for (const p of WAGER_SIGNALS) {
    if (p.test(text)) {
      signals.push(`wager: ${p.source}`);
      suggestedType = suggestedType ?? "wager";
    }
  }

  if (!suggestedType) return null;
  return { pair, suggestedType, signals };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd ~/handprint && npx vitest run tests/scanner/claude-code.test.ts`
Expected: 6 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/scanner/claude-code.ts tests/scanner/claude-code.test.ts
git commit -m "feat(scanner): Claude Code transcript parser and classifier"
```

---

## Task 16: `handprint scan` Command (Wiring Git + Claude Code Scanners)

**Files:**
- Create: `src/commands/scan.ts`

- [ ] **Step 1: Write the scan command**

```typescript
// src/commands/scan.ts
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { parseGitLog, classifyCommit, type ScanCandidate } from "../scanner/git.js";
import {
  parseTranscriptLine,
  extractConversationPairs,
  classifyPair,
  type TranscriptCandidate,
} from "../scanner/claude-code.js";

export interface ScanResult {
  gitCandidates: ScanCandidate[];
  transcriptCandidates: TranscriptCandidate[];
}

export function scanGitHistory(repoRoot: string, limit: number = 50): ScanCandidate[] {
  try {
    const raw = execSync(
      `git log --format="%H|%aI|%an|%s" -n ${limit}`,
      { cwd: repoRoot, encoding: "utf-8" }
    );
    const commits = parseGitLog(raw);
    return commits.map(classifyCommit).filter((c): c is ScanCandidate => c !== null);
  } catch {
    return [];
  }
}

export function scanClaudeTranscripts(claudeDir?: string): TranscriptCandidate[] {
  const baseDir = claudeDir ?? join(process.env.HOME ?? "~", ".claude", "projects");
  if (!existsSync(baseDir)) return [];

  const candidates: TranscriptCandidate[] = [];

  for (const project of readdirSync(baseDir)) {
    const projectDir = join(baseDir, project);
    const files = readdirSync(projectDir).filter((f) => f.endsWith(".jsonl"));

    for (const file of files.slice(-5)) {
      const lines = readFileSync(join(projectDir, file), "utf-8").split("\n");
      const entries = lines.map(parseTranscriptLine).filter((e) => e !== null);
      const pairs = extractConversationPairs(entries);
      for (const pair of pairs) {
        const candidate = classifyPair(pair);
        if (candidate) candidates.push(candidate);
      }
    }
  }

  return candidates;
}

export function scan(repoRoot: string, claudeDir?: string): ScanResult {
  return {
    gitCandidates: scanGitHistory(repoRoot),
    transcriptCandidates: scanClaudeTranscripts(claudeDir),
  };
}
```

- [ ] **Step 2: Wire scan into CLI**

Add to `bin/handprint.ts`, before `program.parse()`:

```typescript
import { scan } from "../src/commands/scan.js";

program
  .command("scan")
  .description("Scan git history and Claude Code transcripts for handprint candidates")
  .option("-n, --limit <n>", "Number of git commits to scan", "50")
  .action((opts) => {
    const result = scan(process.cwd());
    const total = result.gitCandidates.length + result.transcriptCandidates.length;

    if (total === 0) {
      console.log("no handprint candidates found");
      return;
    }

    if (result.gitCandidates.length > 0) {
      console.log(`\n— git commits (${result.gitCandidates.length}) —`);
      for (const c of result.gitCandidates) {
        console.log(`  ${c.commit.hash.slice(0, 7)}  [${c.suggestedType}]  ${c.commit.message}`);
      }
    }

    if (result.transcriptCandidates.length > 0) {
      console.log(`\n— claude code (${result.transcriptCandidates.length}) —`);
      for (const c of result.transcriptCandidates) {
        const preview = c.pair.user.text.slice(0, 80);
        console.log(`  [${c.suggestedType}]  "${preview}..."`);
      }
    }

    console.log(`\n${total} candidates found. Use 'handprint seal' to record.`);
  });
```

- [ ] **Step 3: Test scan on real data**

Run: `cd ~/handprint.sh && npx tsx ~/handprint/bin/handprint.ts scan`
Expected: Shows candidates from the handprint.sh git history

- [ ] **Step 4: Commit**

```bash
git add src/commands/scan.ts bin/handprint.ts
git commit -m "feat(commands): handprint scan wires git + claude code scanners"
```

---

## Task 17: End-to-End Smoke Test

- [ ] **Step 1: Run full test suite**

Run: `cd ~/handprint && npx vitest run`
Expected: All tests pass

- [ ] **Step 2: End-to-end CLI test**

```bash
cd /tmp && mkdir handprint-e2e && cd handprint-e2e
git init
npx tsx ~/handprint/bin/handprint.ts init
npx tsx ~/handprint/bin/handprint.ts seal -t override -i "Edge JWT over gateway" -r "Revocation gap" -c "auth-v2"
npx tsx ~/handprint/bin/handprint.ts seal -t constraint -i "No vendor auth in billing" -r "Lock-in cost" -c "billing"
npx tsx ~/handprint/bin/handprint.ts log
npx tsx ~/handprint/bin/handprint.ts show $(ls .handprint/objects/*/* | head -1 | xargs -I{} basename {})
npx tsx ~/handprint/bin/handprint.ts export
```

Expected: Each command produces correct output, no errors.

- [ ] **Step 3: Verify .handprint/ structure**

```bash
find .handprint -type f | sort
```

Expected:
```
.handprint/config.json
.handprint/log
.handprint/objects/XX/YYYYYY...
.handprint/objects/XX/YYYYYY...
.handprint/refs/
.handprint/staging/
```

- [ ] **Step 4: Clean up and commit final state**

```bash
cd ~/handprint
git add -A
git commit -m "feat: handprint CLI MVP — init, seal, log, show, resolve, export, scan"
```

---

## Self-Review Checklist

- [x] **Spec coverage**: init ✓, seal ✓, log ✓, show ✓, resolve ✓, export ✓, scan (git + claude) ✓, .handprint/ structure ✓, content-addressable storage ✓, short-hash resolution ✓
- [x] **No placeholders**: Every step has complete code
- [x] **Type consistency**: `HandprintType`, `ResolutionStatus`, `Handprint`, `Resolution` used consistently across all tasks. `hashObject` / `writeObject` / `readObject` signatures consistent.
- [x] **Import paths**: All use `.js` extension for ESM compatibility
