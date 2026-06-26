import {
  createHash,
  generateKeyPairSync,
  sign,
  verify,
  randomBytes,
  createCipheriv,
  createDecipheriv,
} from "node:crypto";

// Ed25519 for signing
export function generateSigningKeypair(): {
  publicKey: string;
  privateKey: string;
} {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  return { publicKey, privateKey };
}

// AES-256-GCM for payload encryption (symmetric, local-only)
export function generateEncryptionKey(): Buffer {
  return randomBytes(32);
}

export function encrypt(plaintext: string, key: Buffer): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  // Pack: iv (12) + tag (16) + ciphertext
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function decrypt(packed: string, key: Buffer): string {
  const buf = Buffer.from(packed, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const ciphertext = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(ciphertext) + decipher.final("utf-8");
}

export function signData(data: string, privateKeyPem: string): string {
  const sig = sign(null, Buffer.from(data), privateKeyPem);
  return sig.toString("base64");
}

export function verifySignature(
  data: string,
  signature: string,
  publicKeyPem: string,
): boolean {
  return verify(
    null,
    Buffer.from(data),
    publicKeyPem,
    Buffer.from(signature, "base64"),
  );
}
