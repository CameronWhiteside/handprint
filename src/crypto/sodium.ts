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
  if (!ready) throw new Error('call ensureSodium() first');
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
  return sodium.to_base64(bytes, sodium.base64_variants.URLSAFE_NO_PADDING);
}

export function fromBase64url(str: string): Uint8Array {
  return sodium.from_base64(str, sodium.base64_variants.URLSAFE_NO_PADDING);
}
