import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readObject } from '../store/objects.js';
import { projectDir } from '../dirs/project.js';
import { loadAllSeeds } from '../dirs/global.js';
import { deriveEncryptionKey, decrypt } from '../crypto/noble.js';
import { handprintObjectSchema } from '@handprint/types';
import type { HandprintObject } from '@handprint/types';

export interface HandprintDetail {
  hash: string;
  handprint: HandprintObject;
  decryptedPayload?: string;
}

export async function showHandprint(
  projectRoot: string,
  ref: string,
  options?: { decrypt?: boolean },
): Promise<HandprintDetail | null> {
  const hpDir = projectDir(projectRoot);
  let fullHash: string | null = null;

  if (ref.length === 64) {
    fullHash = ref;
  } else if (ref.length >= 7) {
    fullHash = resolvePrefix(hpDir, ref);
  }

  if (!fullHash) return null;

  const obj = readObject(hpDir, fullHash);
  if (!obj) return null;

  const parsed = handprintObjectSchema.safeParse(obj);
  if (!parsed.success) return null;
  const hp: HandprintObject = parsed.data;
  const result: HandprintDetail = { hash: fullHash, handprint: hp };

  if (options?.decrypt && hp.payload) {
    // Try the current key and every archived (rotated) key, so payloads written
    // before a key rotation still decrypt.
    for (const seed of loadAllSeeds()) {
      try {
        const encKey = await deriveEncryptionKey(seed);
        result.decryptedPayload = await decrypt(hp.payload, encKey);
        break;
      } catch {
        // try the next archived key
      }
    }
  }

  return result;
}

function resolvePrefix(hpDir: string, prefix: string): string | null {
  const dirPrefix = prefix.slice(0, 2);
  const filePrefix = prefix.slice(2);
  const bucketDir = join(hpDir, 'objects', dirPrefix);

  if (!existsSync(bucketDir)) return null;

  const files = readdirSync(bucketDir);
  const matches = files.filter((f) => f.startsWith(filePrefix));

  if (matches.length !== 1) return null;
  return dirPrefix + matches[0];
}
