# Handprint Profile + Push — Design Spec

## Principle

Every metric is deterministic. The protocol defines exactly how each number is derived. No AI interprets profiles — anyone can verify any metric by running the same computation on the same data. Configuration is explicit and versioned in `.handprint/config.json`.

---

## 1. Configuration Schema (`.handprint/config.json`)

The config file is the single source of truth for all tunable parameters. Every computation references it.

```jsonc
{
  "version": "0.1.0",
  "createdAt": "2026-06-06T...",

  // Identity — user-provided, never inferred
  "identity": {
    "handle": "@cameron",
    "name": "Cameron Whiteside",
    "email": "whiteside.cameron@gmail.com"
  },

  // Remote — where to push profiles
  "remote": {
    "type": "cloudflare-kv",
    "accountId": "fc2c0899222b85aeef1addc03f575e6d",
    "namespaceId": null  // set on first push, or manually
  },

  // Protocol parameters — every formula is configurable
  "protocol": {
    "calibration": {
      "weights": {
        "validated": 1.0,
        "partial": 0.5,
        "revised": 0.25,
        "invalidated": 0.0
      },
      "minResolved": 5  // minimum resolved handprints before computing score
    },
    "domains": {
      "strongThreshold": 0.10  // >10% of handprints = strong tag
    },
    "heatmap": {
      "weeks": 52,
      "levels": 5  // 0-4 intensity scale
    },
    "featured": {
      "strategy": "most-anchors"  // deterministic: most anchors, then longest intent
    },
    "anchors": {
      "commitWindowBefore": "PT30M",  // look 30min before handprint timestamp
      "commitWindowAfter": "PT60M",   // look 60min after
      "linkPRs": true,
      "linkRepo": true
    }
  }
}
```

### Config CLI

- `handprint config set identity.handle @cameron` — set a config value
- `handprint config get protocol.calibration.weights` — read a config value
- `handprint config show` — dump full config

---

## 2. Anchor Enrichment

### When: During `handprint ingest`

After a handprint is extracted and before it's sealed, enrich it with code artifacts from the session context.

### Inputs

- `cwd` from the transcript entry — the repo directory
- `timestamp` from the handprint
- `gitBranch` from the transcript entry (if available)
- Config: `protocol.anchors.*`

### Algorithm

```
for each extracted handprint:
  1. repo_url = git remote get-url origin (from cwd)
     → anchor { label: "repo:<url>", verified: true }
  
  2. branch = gitBranch from transcript entry
     → anchor { label: "branch:<name>", verified: true }
  
  3. commits = git log --format="%H|%s" 
       --after=<timestamp - commitWindowBefore>
       --before=<timestamp + commitWindowAfter>
       (in cwd)
     → for each: anchor { label: "git:<short-hash>", verified: true }
  
  4. if linkPRs and branch exists:
       pr_url = gh pr list --head <branch> --json url --limit 1
       → anchor { label: "pr:<url>", verified: true }
```

### Failure Modes

- No git remote → skip repo anchor (still seal the handprint)
- Not a git repo → skip all git anchors
- `gh` not installed → skip PR anchor
- Any command fails → skip that anchor, log warning, continue

---

## 3. `handprint profile` — Deterministic Profile Generation

### Output: `.handprint/profile.json`

A single JSON document computed entirely from the handprint data + config. No AI, no network calls.

### Profile Schema

```typescript
interface HandprintProfile {
  // Metadata
  version: string;           // protocol version from config
  generatedAt: string;       // ISO timestamp of generation
  handle: string;            // from config.identity
  name: string;              // from config.identity

  // Type distribution — raw counts
  typeCounts: {
    direction: number;
    override: number;
    rejection: number;
    constraint: number;
    wager: number;
  };
  total: number;
  
  // Calibration — formula is protocol-defined
  calibration: {
    score: number | null;    // null if < minResolved
    resolved: number;
    open: number;
    breakdown: {
      validated: number;
      partial: number;
      revised: number;
      invalidated: number;
    };
    formula: string;         // human-readable formula for transparency
  };

  // Domain tags — extracted from context field, sorted by frequency
  domains: Array<{
    name: string;            // unique context value
    count: number;
    percentage: number;
    strong: boolean;         // > strongThreshold
  }>;

  // Tool distribution — from source field
  tools: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;

  // Activity
  heatmap: Array<{
    date: string;            // YYYY-MM-DD
    count: number;
    level: number;           // 0-4
  }>;
  streak: {
    current: number;         // consecutive days
    longest: number;
  };
  firstHandprint: string;    // ISO date
  
  // Featured — deterministic selection
  featured: {
    hash: string;
    strategy: string;        // which strategy selected it
  } | null;

  // Timeline — grouped by month, newest first
  timeline: Array<{
    month: string;           // "jun · 2026"
    entries: Array<{
      hash: string;
      day: string;
      time: string;
      type: string;
      context: string;
      intent: string;
      risk: string;
      status: string;
      statusLabel: string;
      horizon: string | null;
      anchors: Array<{ label: string; verified: boolean }>;
      resolutions: Array<{
        status: string;
        body: string;
        timestamp: string;
      }>;
    }>;
  }>;

  // Repo links — unique repos referenced in anchors
  repos: Array<{
    url: string;
    handprintCount: number;
  }>;
}
```

### Computation Details

**Calibration Score:**
```
if resolved < config.protocol.calibration.minResolved:
  score = null

score = sum(
  breakdown[status] * config.protocol.calibration.weights[status]
  for status in [validated, partial, revised, invalidated]
) / resolved

formula = "({validated}×{w_val} + {partial}×{w_par} + {revised}×{w_rev} + {invalidated}×{w_inv}) / {resolved}"
```

**Domain Tags:**
```
domains = group handprints by context field
  → count per unique context
  → sort descending by count
  → percentage = count / total
  → strong = percentage > config.protocol.domains.strongThreshold
```

**Heatmap:**
```
for each day in last config.protocol.heatmap.weeks weeks:
  count = handprints with timestamp on that day
  max_count = max(all daily counts)
  level = floor(count / max_count * (config.protocol.heatmap.levels - 1))
    (0 if count == 0)
```

**Streak:**
```
current = count consecutive days backward from today with >= 1 handprint
longest = max streak found scanning all days
```

**Featured:**
```
if strategy == "most-anchors":
  sort handprints by len(anchors) descending
  tiebreaker: longest intent text
  pick first
```

---

## 4. `handprint push` — Publish to Cloudflare KV

### Prerequisites

- `.handprint/profile.json` exists (run `handprint profile` first, or auto-run it)
- Wrangler OAuth token in `~/.wrangler/config/default.toml`
- Account ID in config or auto-detected

### KV Schema

Key pattern: `<handle>:<resource>`

| Key | Value | Description |
|-----|-------|-------------|
| `@cameron:profile` | Full profile JSON | The complete HandprintProfile |
| `@cameron:meta` | `{ handle, name, total, lastPush }` | Lightweight index entry |

### API Calls

```
PUT /accounts/{accountId}/storage/kv/namespaces/{nsId}/values/@cameron:profile
PUT /accounts/{accountId}/storage/kv/namespaces/{nsId}/values/@cameron:meta
```

Using the Cloudflare REST API with the wrangler OAuth token.

### First Push Setup

If `config.remote.namespaceId` is null:
1. Create a KV namespace named `handprint-profiles`
2. Save the namespace ID to config
3. Bind it to the handprint.sh worker (via API or prompt user to add to wrangler.toml)

---

## 5. Wire `handprint.sh` — Dynamic Profile Page

### Changes to `wrangler.toml`

```toml
[[kv_namespaces]]
binding = "PROFILES"
id = "<namespace-id>"
```

### Changes to `src/index.tsx`

The `/profile/:handle` route:
1. Look up `<handle>:profile` from KV
2. If found → render profile page with real data
3. If not found → render with demo data from `en.ts` (marketing fallback)

### Data Transform Layer

A new module `src/data/transform.ts` that maps `HandprintProfile` → the shape `ProfilePage` expects. This is a pure function, no side effects:

- Maps `typeCounts` → filter chips with counts
- Maps `calibration` → calibration card data
- Maps `domains` → sidebar domain list
- Maps `timeline` → month-grouped entries with display formatting
- Maps `heatmap` → 52-week grid data
- Maps `featured.hash` → full featured handprint card
- Maps `tools` → sidebar tools list
- Maps `repos` → anchor links in timeline entries

### What Stays Static

All labels, section titles, and UI copy remain in `en.ts`. Only the DATA becomes dynamic. The profile page receives both:
- `translations` (static copy from `en.ts`)
- `profileData` (dynamic from KV, type `HandprintProfile`)

---

## Out of Scope (MVP)

- Attestations / peer signatures
- Cryptographic signing / CT log
- Cross-engineer search / discovery
- Calibration trend over time
- Badges
- RSS / JSON feed endpoints
- Multi-language support

---

## File Structure (new/modified)

```
~/handprint/                          # CLI tool
├── src/
│   ├── commands/
│   │   ├── profile.ts               # NEW — generate profile.json
│   │   ├── push.ts                  # NEW — push to Cloudflare KV
│   │   └── config.ts                # NEW — config get/set/show
│   ├── profile/
│   │   ├── compute.ts               # NEW — all deterministic computations
│   │   ├── anchors.ts               # NEW — git/PR anchor enrichment
│   │   └── types.ts                 # NEW — HandprintProfile type
│   └── commands/
│       └── ingest.ts                # MODIFIED — call anchor enrichment

~/handprint.sh/                       # Marketing site
├── wrangler.toml                     # MODIFIED — add KV binding
├── src/
│   ├── index.tsx                     # MODIFIED — KV lookup in profile route
│   ├── data/
│   │   └── transform.ts             # NEW — HandprintProfile → page props
│   └── pages/
│       └── profile.tsx              # MODIFIED — accept dynamic data
```
