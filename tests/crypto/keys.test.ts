import { describe, it, expect } from "vitest";
import {
  generateSigningKeypair,
  generateEncryptionKey,
  encrypt,
  decrypt,
  signData,
  verifySignature,
} from "../../src/crypto/keys.js";

describe("crypto/keys", () => {
  describe("generateSigningKeypair", () => {
    it("generates Ed25519 PEM keypair", () => {
      const { publicKey, privateKey } = generateSigningKeypair();
      expect(publicKey).toContain("BEGIN PUBLIC KEY");
      expect(privateKey).toContain("BEGIN PRIVATE KEY");
    });

    it("generates unique keypairs each call", () => {
      const a = generateSigningKeypair();
      const b = generateSigningKeypair();
      expect(a.publicKey).not.toBe(b.publicKey);
    });
  });

  describe("generateEncryptionKey", () => {
    it("returns a 32-byte buffer", () => {
      const key = generateEncryptionKey();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32);
    });
  });

  describe("encrypt / decrypt", () => {
    it("roundtrips plaintext through AES-256-GCM", () => {
      const key = generateEncryptionKey();
      const plaintext = "hello, this is a secret message";
      const ciphertext = encrypt(plaintext, key);
      expect(ciphertext).not.toBe(plaintext);
      const decrypted = decrypt(ciphertext, key);
      expect(decrypted).toBe(plaintext);
    });

    it("produces different ciphertext each time (random IV)", () => {
      const key = generateEncryptionKey();
      const plaintext = "same text";
      const a = encrypt(plaintext, key);
      const b = encrypt(plaintext, key);
      expect(a).not.toBe(b);
      // Both should decrypt to the same thing
      expect(decrypt(a, key)).toBe(plaintext);
      expect(decrypt(b, key)).toBe(plaintext);
    });

    it("fails to decrypt with wrong key", () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      const ciphertext = encrypt("secret", key1);
      expect(() => decrypt(ciphertext, key2)).toThrow();
    });

    it("handles empty string", () => {
      const key = generateEncryptionKey();
      const ciphertext = encrypt("", key);
      expect(decrypt(ciphertext, key)).toBe("");
    });

    it("handles unicode", () => {
      const key = generateEncryptionKey();
      const text = "Hello world! Decisions matter.";
      const ciphertext = encrypt(text, key);
      expect(decrypt(ciphertext, key)).toBe(text);
    });
  });

  describe("signData / verifySignature", () => {
    it("signs and verifies data", () => {
      const { publicKey, privateKey } = generateSigningKeypair();
      const data = "important data to sign";
      const sig = signData(data, privateKey);
      expect(sig).toBeTruthy();
      expect(verifySignature(data, sig, publicKey)).toBe(true);
    });

    it("rejects tampered data", () => {
      const { publicKey, privateKey } = generateSigningKeypair();
      const sig = signData("original", privateKey);
      expect(verifySignature("tampered", sig, publicKey)).toBe(false);
    });

    it("rejects wrong public key", () => {
      const kp1 = generateSigningKeypair();
      const kp2 = generateSigningKeypair();
      const sig = signData("data", kp1.privateKey);
      expect(verifySignature("data", sig, kp2.publicKey)).toBe(false);
    });
  });
});
