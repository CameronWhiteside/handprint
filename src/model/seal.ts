export interface Seal {
  v: number; // schema version (1)
  ts: string; // ISO timestamp of the conversation chunk
  session: string; // session/chat ID
  project: string; // project identifier
  author: string; // git user identity
  parent: string | null; // hash of previous seal (chain link)
  payload: string; // base64 AES-256-GCM encrypted sanitized message
  signature: string; // Ed25519 signature over the canonical JSON (without signature field)
  pubkey: string; // public key PEM (so anyone can verify)
}

export interface SealInput {
  ts: string;
  session: string;
  project: string;
  author: string;
  plaintext: string; // the sanitized conversation text (pre-encryption)
}
