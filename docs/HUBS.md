# Hubs and origin

handprint is hub-agnostic by design. A signed handprint record contains no
reference to any hub: it is portable and verifiable with just the public key.
The hub is configured separately, as your "origin." handprint.sh is the default
hub, not the protocol.

## What works today

### The origin is configurable
Your origin is `hub.url` in `~/.handprint/config.json`, defaulting to
`https://handprint.sh`. Point it anywhere:

```sh
handprint config set hub.url https://your-hub.example --global
```

Every hub interaction (`login`, `push`, `keys`) uses this value.

### Auth is device-flow, per hub
`handprint login` asks the configured hub for a device code; you authorize in a
browser at that hub; the hub issues a token stored in
`~/.handprint/credentials.json`. The CLI never talks to GitHub directly. How a
hub authenticates you (GitHub, Google, or anything else) is the hub's concern,
not the protocol's. handprint.sh happens to use GitHub OAuth; another hub can use
whatever it wants.

### Records are portable
`handprint push` sends `{ v, ts, marks, artifacts, source, parent, sig, pubkey }`
to `<hub.url>/api/v1/...`. The encrypted payload never leaves your machine. The
same records can be pushed to any compatible hub, and `handprint verify` needs
only the chain plus the public key, with no hub involved.

## How handprint.sh is connected
handprint.sh is simply the default `hub.url`. The CLI calls its
`/api/v1/push/handprint`, `/api/v1/keys`, and `/api/auth/device*` endpoints, and
handprint.sh runs GitHub OAuth for the device-authorization step. Nothing about
handprint.sh is baked into the signed record or the protocol.

## Roadmap: first-class self-hosting

The protocol and records are already hub-agnostic. These pieces are not done yet,
and would make running your own hub first-class. This is deliberately NOT
git-style remote management:

- **Published hub API contract.** The endpoints above are stable in practice but
  not yet documented as a spec for third parties. A reference (OpenAPI plus the
  device-auth handshake) would let anyone run a compatible hub.
- **Multiple origins / per-project override.** Today there is a single global
  `hub.url`. No multi-hub or per-project origin, by choice.
- **Per-hub credentials.** `credentials.json` holds one token; switching hubs
  means logging in again.
- **`init --hub <url>` sugar.** Set the origin at init time instead of a
  follow-up `config set`.
- **Self-host guide.** A walkthrough for standing up a compatible hub with an
  OAuth provider of your choice.

The principle holds at every step: the protocol and records stay hub-agnostic
(portable, hub-free, verifiable offline); the hub is pluggable through a single
configurable origin plus device auth.
