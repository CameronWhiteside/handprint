# Handprint FAQ

> Code is cheap. Your expertise is not.

## What is Handprint?

### What is handprint?

Handprint is a human decision provenance protocol. It captures the decisions you make while working with AI agents, signs them cryptographically, and publishes structured provenance to a hub. Think of it as a verifiable record of your judgment -- the goals you set, the trade-offs you navigated, the approaches you chose -- independent of the code or content that resulted.

### What problem does it solve?

AI tools increasingly generate the outputs (code, designs, text), but the decisions that shape those outputs are still human. Today, those decisions evaporate -- lost in ephemeral chat sessions, undocumented in commits, invisible to anyone reviewing the work later. Handprint captures decision provenance so the human expertise behind AI-assisted work is recorded, signed, and attributable.

### What is a "handprint" exactly?

A handprint is a signed, immutable JSON object that records one or more human decisions from an AI interaction. It contains marks (typed decisions), artifact references (what the decisions produced), source metadata (which agent was involved), an encrypted payload of the sanitized conversation, a cryptographic signature, and a link to the previous handprint forming a Merkle chain. Once signed, a handprint is never modified.

### What are marks?

Marks are the structured decisions inside a handprint. Each mark has a type, subtype, and a note (up to 280 characters). The three types are: **vision** (goal, direction, principle), **choice** (approval, override, rejection, constraint, inquiry), and **method** (tool, knowledge, process). Together they capture what you wanted, what you decided, and how you decided it.

### What are artifacts?

Artifacts are references to the outputs that a decision influenced -- a git commit, a file, a URL, a deployment, a C2PA manifest, or a custom reference. Each artifact stores a type, URI, and optional content hash. Artifacts are pointers, not copies. Human-readable names come from resolving the URI (e.g., the commit message or filename).

### How is this different from git blame or commit messages?

Git blame tells you who changed a line of code. Commit messages describe what changed. Neither captures why -- the goals, trade-offs, rejected alternatives, and domain knowledge that shaped the work. Handprint records the decision layer: the human judgment that directed the AI, signed cryptographically and linked to the artifacts it produced.

### Is this just for code? What about design, writing, business decisions?

Handprint is tool-agnostic and output-agnostic. Artifact types include files, URLs, deployments, and custom references -- not just git commits. Any AI-assisted decision can be captured: architecture choices, design direction, content strategy, business trade-offs. If you made a decision while working with an AI agent, handprint can record it.

## Privacy & Data

### What data does handprint collect?

Handprint extracts structured marks (type, subtype, note) and artifact references from your AI conversations. It also records source metadata (which agent you used, which model extracted the handprint) and timestamps. Your raw conversation text is sanitized, encrypted, and stored locally -- it is never sent to the hub.

### What NEVER leaves my machine?

Five things never leave your machine: (1) your seed (private key material), stored at `~/.handprint/keys/seed` with mode 0600, (2) the encryption key, which exists only in memory and is wiped after use, (3) raw conversation text, which is never stored even locally, (4) sanitized conversation text, which is encrypted and stored in `.handprint/objects/`, and (5) hub auth tokens, which are encrypted in `~/.handprint/credentials.json`.

### What gets published to the hub?

When you `handprint push`, the hub receives: marks (type, subtype, note), artifact references (type, URI, hash), source metadata (agent, extractor, session), timestamps, your Ed25519 signature and public key, and the parent hash linking to the previous handprint. The encrypted conversation payload is explicitly excluded from the push -- it stays local.

### Can my employer/team see my conversations?

No. Conversation payloads are encrypted with a key derived from your personal seed via BLAKE2b. Only you can decrypt them. The hub never receives conversation text in any form. Your team can see your published marks and artifact references if you set a project's visibility to `public` or `unlisted`, but never the underlying conversations.

### What is the sanitization pipeline?

Before encryption, your conversation input passes through aggressive sanitization: email addresses become `[REDACTED_EMAIL]`, API keys and secrets (ALL_CAPS patterns) become `[REDACTED_KEY]`, URL auth tokens become `[REDACTED_TOKEN]`, and high-entropy strings (8+ mixed alphanumeric characters) become `[REDACTED_TOKEN]`. False positives are acceptable -- over-redaction is intentionally preferred over under-redaction. Sanitization is defense-in-depth behind encryption, not a primary security boundary.

### What does "private by default" mean?

Every new project starts with visibility set to `private`. In this mode, handprints are stored locally only and `handprint push` skips the project entirely. You must explicitly change visibility to `unlisted` (pushed but not indexed) or `public` (pushed and indexed on your profile) to share anything. No data leaves your machine unless you opt in.

### Can I delete my data?

You can delete your local `.handprint/objects/` directory at any time to remove local handprint data. For data already pushed to the hub, handprints are designed to be immutable provenance records. Deletion from the hub would be handled through the hub's data management policies. The protocol treats provenance as permanent -- marks record decisions that were made, and rewriting that history would undermine the integrity guarantees.

### What about GDPR?

The protocol is local-first by design, which aligns well with data minimization principles. Conversation data never leaves your machine. Published marks contain only structured decision metadata (type, subtype, and a short note you can review before pushing), not personal data. For data already on the hub, standard GDPR data subject rights (access, erasure) would be handled at the hub service level.

## Security & Cryptography

### How are handprints signed?

Each handprint is canonicalized (sorted keys, no whitespace, deterministic JSON), hashed with SHA-256, and then signed with your Ed25519 private key. The 64-byte signature and your 32-byte public key are included in the handprint object. Anyone with your public key can verify that you authored the handprint and that it has not been tampered with.

### What cryptographic algorithms does handprint use?

Handprint uses Ed25519 for digital signatures, BLAKE2b (via libsodium `crypto_generichash`) for deriving the encryption key from your seed, XSalsa20-Poly1305 (via libsodium `crypto_secretbox`) for authenticated encryption of conversation payloads, and SHA-256 for content addressing and the Merkle chain. All cryptography runs through libsodium -- one audited library, no custom crypto.

### Why Ed25519 and not RSA/ECDSA?

Ed25519 offers 32-byte keys (vs. hundreds of bytes for RSA), deterministic signatures (no random nonce means no catastrophic nonce-reuse bugs like ECDSA), constant-time operations by construction, and broad library support. A base64url-encoded Ed25519 public key is 43 characters -- compact enough to embed in every handprint object.

### Is my encrypted data safe from quantum computers?

Yes, with an important nuance. The encryption key is derived from your seed via BLAKE2b, a one-way hash function. A quantum computer running Shor's algorithm could recover your Ed25519 private scalar from your public key, but it cannot recover the original seed -- SHA-512 and BLAKE2b are unaffected by Shor's algorithm (which targets discrete logarithm and factoring, not hash preimages). Your encrypted payloads remain safe. Your signatures, however, would become forgeable -- which is why the protocol includes a versioned signature scheme with a migration path to hybrid Ed25519 + ML-DSA (post-quantum) in v2.

### Why not just use GPG?

GPG solves a different problem (encrypted communication) and carries substantial complexity: key servers, web of trust, ASN.1/PEM encoding, large keys, and a notoriously difficult user experience. Handprint needs compact signatures embedded in JSON objects, a single seed that derives everything, and a library (libsodium) that provides constant-time operations without configuration. The total crypto dependency is ~200KB of WebAssembly.

### What is the Merkle chain and why does it matter?

Each handprint includes a `parent` field containing the SHA-256 hash of the previous handprint, forming a hash chain from HEAD back to genesis. This means any tampering with a historical handprint would break the chain -- the hashes would not match. The chain provides ordering guarantees, tamper evidence, and a verifiable history of all your decisions in a project.

### Can someone forge a handprint?

Not without your seed. Forging a handprint requires producing a valid Ed25519 signature, which requires the private key derived from your seed. The hub also verifies signatures on push against your registered public keys and enforces chain continuity -- an attacker cannot insert handprints into the middle of your chain. If your key is compromised, see the key revocation question below.

### What happens if my private key is compromised?

Run `handprint keys revoke <fingerprint>` to mark the compromised key on the hub. Handprints signed with revoked keys will show a warning during verification. Old handprints remain in the chain (provenance is permanent), but verifiers are alerted to the compromise. Limitation: revocation is best-effort -- it only works when verifiers check the hub. Offline verifiers who do not check revocation status would still see a valid signature.

### How does key rotation work?

Run `handprint keys rotate` to generate a new seed, register the new public key with the hub, and mark the old key as retired with a timestamp. Old handprints remain verifiable because the hub retains retired public keys. Important caveat: payloads encrypted with the old seed's derived key become unreadable unless you backed up the old seed first. The CLI warns about this before completing rotation. Marks (the structured provenance) are unaffected since they are stored unencrypted on the hub.

### What is the seed and how should I back it up?

The seed is 32 random bytes stored at `~/.handprint/keys/seed` (base64url-encoded, 43 characters). Everything is derived from it: your Ed25519 signing keypair, your encryption key, your fingerprint. You can export it with `handprint keys export` (requires confirmation). Store the backup in a password manager or other secure offline location. If you lose the seed, you lose the ability to sign new handprints with that identity and decrypt old conversation payloads.

## Using Handprint

### How do I install it?

Two options. **npm** (cryptographically verified): `npm install -g handprint-sh`, then verify with `npm audit signatures`. **curl** (convenience): `curl -fsSL handprint.sh/install | sh`, which downloads from GitHub Releases, verifies SHA-256 checksums, and installs to `~/.handprint/bin/`. The CLI requires Node.js 20+ and has a total dependency footprint of ~340KB with no native compilation.

### How do I set up handprint in a project?

Run `handprint init` in your project directory. This creates a `.handprint/` directory with a config file (defaulting to `private` visibility), an AGENTS.md pointer file for AI tools, and a .gitignore that tracks config and AGENTS.md while ignoring objects and refs. On first run, it also sets up `~/.handprint/` globally with your seed and keys if they do not already exist.

### How does handprint detect decisions?

When you run `handprint grab`, the CLI scans registered transcript sources (Claude Code, Cursor, etc.) for new conversation chunks since the last scan. It runs those chunks through a lightweight extractor model that identifies marks (vision/choice/method decisions) and enriches them with artifact references like recent git commits or changed files. Detection is automatic -- you do not manually tag decisions.

### Which AI tools does it work with?

Handprint is agent-first and tool-agnostic. It can work with any AI tool that produces conversation transcripts: Claude Code, Cursor, Codex, Lovable, Bolt, and others. Transcript sources are registered in `~/.handprint/sources/` with their path, format, and last-scanned timestamp. The protocol does not depend on any specific agent's API.

### Do I need to manually tag decisions?

No. The entire point of handprint is ambient detection. Decisions are extracted automatically by the extractor model when you run `handprint grab`. You review the extracted marks before signing, but you should never need to write them by hand. Manual authoring would defeat the purpose of capturing organic decision provenance.

### What's the difference between grab, sign, and push?

`handprint grab` scans your AI transcripts, extracts decisions as marks, encrypts the sanitized conversation, signs the handprint with your Ed25519 key, and stores it locally in `.handprint/objects/`. Signing happens as part of grab -- there is no separate sign step. `handprint push` then publishes your local handprints to the hub (minus the encrypted payload), respecting each project's visibility setting.

### Can I use handprint without publishing anything?

Yes. Set your project visibility to `private` (the default) and `handprint push` will skip it. You still get the full local chain: signed handprints, Merkle chain integrity, local verification with `handprint verify`, and encrypted conversation payloads. Handprint works entirely offline as a personal decision log.

### How do I use multiple devices?

Each device gets its own seed and keypair. Register each device's key with the hub using `handprint keys add --label "MacBook Pro"`. The hub stores all your registered public keys, and when verifying a handprint, it checks the signature against all of them. Any registered key is considered valid for your identity.

## For AI Agents

### How should an AI agent interact with handprint?

Agents interact with handprint through the CLI, using the same commands a human would. The key command is `handprint grab`, which agents should run after significant decisions. Agents discover handprint's presence through the `.handprint/AGENTS.md` file in a project's root. Detailed extraction prompts and type breakdowns live in installable skill packages, not in AGENTS.md itself.

### What is AGENTS.md?

AGENTS.md is a minimal pointer file (under 100 tokens) checked into version control alongside the project. It tells AI agents that handprint is active and directs them to run `handprint grab` after significant decisions. It points to `@handprint-sh/types` for schemas, the CLI for commands, and `handprint.sh/docs` for documentation. It is intentionally tiny to avoid bloating agent context windows.

### When should an agent run `handprint grab`?

After significant decisions -- when the human sets a goal or direction (vision), approves, overrides, or rejects an approach (choice), or specifies a tool, technique, or domain knowledge to apply (method). Not every message is a decision. The extractor model handles the judgment of what qualifies, so agents can run `handprint grab` at natural breakpoints (end of a task, after a commit) rather than after every exchange.

### Does the agent need access to my private key?

The agent needs to be able to execute `handprint grab` as a CLI command, which reads the seed from `~/.handprint/keys/seed` to sign and encrypt. So the agent process needs filesystem access to the seed file (mode 0600, owner-only). The agent never handles key material directly -- the CLI reads, derives, uses, and wipes keys internally. The agent just invokes the command.

## Open Source & Philosophy

### Is handprint open source?

Yes. The CLI (`handprint-sh`), the types package (`@handprint-sh/types`), and the protocol specification are all open source. The hub API and site at handprint.sh are the hosted service. The protocol is designed so that anyone can build alternative tooling against the same schemas.

### What's the relationship between .handprint and .git?

`.handprint` is to handprint.sh what `.git` is to GitHub. Both are local-first data stores that sync to a hosted service. `.git` tracks file changes; `.handprint` tracks decisions. They are complementary -- handprint artifact references often point to git commits, linking the decision layer to the change layer. Both directories live in a project root, and `.handprint/AGENTS.md` is checked into git.

### Why "handprint"? What's the name about?

The name comes from the Cueva de las Manos (Cave of Hands) in Patagonia -- 9,000-year-old stenciled handprints that are the oldest known proof of human presence. A handprint says "I was here, I made this." In a world where AI generates increasing amounts of output, a handprint is cryptographic proof that a human was present, making decisions, applying judgment. The oldest form of human provenance, made digital.

### What does "decisions + outcomes = value" mean?

Marks capture decisions. Artifacts capture outcomes. The link between them is provenance -- the verifiable record that connects what you decided to what resulted. Code, designs, and content are increasingly generated by AI. The scarce, valuable element is the human judgment that shapes them. Handprint makes that judgment visible, attributable, and permanent.

### Why local-first?

Because conversations with AI contain sensitive information -- proprietary code, business strategy, personal context -- that should never be uploaded to a third-party service by default. Local-first means you get full functionality offline, your data stays on your machine unless you explicitly publish, and the cryptographic guarantees (signing, encryption) do not depend on trusting a server. Privacy is the architecture, not a policy promise.

### Can I self-host the hub?

The protocol is open and the schemas are published. The hub API accepts standard JSON payloads (marks, artifacts, source, signature) over HTTPS. Building an alternative hub that indexes handprints using the same `@handprint-sh/types` schemas is architecturally straightforward. Self-hosting documentation is not yet available but is a natural extension of the open-source design.
