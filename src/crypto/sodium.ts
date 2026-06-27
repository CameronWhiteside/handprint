import * as ed25519 from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { xsalsa20poly1305 } from '@noble/ciphers/salsa.js';
import { blake2b } from '@noble/hashes/blake2.js';
import { randomBytes } from '@noble/hashes/utils.js';

// @noble/ed25519 v3 requires an explicit sha512 implementation
ed25519.hashes.sha512 = sha512;

const ENCRYPTION_CONTEXT = 'payload-encryption-v1';
const NONCE_BYTES = 24;

/** No-op — noble is synchronous and needs no init. Kept for caller compat. */
export async function ensureSodium(): Promise<void> {}

export async function generateSeed(): Promise<Uint8Array> {
  return randomBytes(32);
}

export async function deriveKeypair(seed: Uint8Array): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  const publicKey = ed25519.getPublicKey(seed);
  // In noble, the 32-byte seed IS the private key
  return { publicKey, privateKey: seed };
}

export async function deriveEncryptionKey(seed: Uint8Array): Promise<Uint8Array> {
  const context = new TextEncoder().encode(ENCRYPTION_CONTEXT);
  return blake2b(context, { dkLen: 32, key: seed });
}

export function fingerprint(publicKey: Uint8Array): string {
  const hash = blake2b(publicKey, { dkLen: 32 });
  return toBase64url(hash).slice(0, 16);
}

export async function signDetached(
  message: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array> {
  // noble ed25519 sign() takes (message, privateKey)
  return ed25519.sign(message, privateKey);
}

export async function verifyDetached(
  signature: Uint8Array,
  message: Uint8Array,
  publicKey: Uint8Array,
): Promise<boolean> {
  try {
    return ed25519.verify(signature, message, publicKey);
  } catch {
    return false;
  }
}

export async function encrypt(plaintext: string, key: Uint8Array): Promise<string> {
  const nonce = randomBytes(NONCE_BYTES);
  const messageBytes = new TextEncoder().encode(plaintext);
  const ciphertext = xsalsa20poly1305(key, nonce).encrypt(messageBytes);
  const packed = new Uint8Array(nonce.length + ciphertext.length);
  packed.set(nonce);
  packed.set(ciphertext, nonce.length);
  return toBase64url(packed);
}

export async function decrypt(packed: string, key: Uint8Array): Promise<string> {
  const bytes = fromBase64url(packed);
  const nonce = bytes.slice(0, NONCE_BYTES);
  const ciphertext = bytes.slice(NONCE_BYTES);
  const decrypted = xsalsa20poly1305(key, nonce).decrypt(ciphertext);
  return new TextDecoder().decode(decrypted);
}

export function toBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export function fromBase64url(str: string): Uint8Array {
  return new Uint8Array(Buffer.from(str, 'base64url'));
}
