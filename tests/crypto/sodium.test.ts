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

  it('deriveKeypair returns 32-byte public + 32-byte private (seed)', async () => {
    const seed = await generateSeed();
    const kp = await deriveKeypair(seed);
    expect(kp.publicKey.length).toBe(32);
    expect(kp.privateKey.length).toBe(32);
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
