import { appendFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { HandprintObject, Mark, Artifact, Source } from '@handprint/types';
import { HANDPRINT_OBJECT_VERSION } from '@handprint/types';
import { loadSeed } from '../dirs/global.js';
import {
  deriveKeypair,
  deriveEncryptionKey,
  signDetached,
  encrypt,
  toBase64url,
} from '../crypto/noble.js';
import { canonicalize, blake2b256 } from '../store/hash.js';
import { writeObject } from '../store/objects.js';
import { getRef, setRef } from '../store/refs.js';
import { sanitize } from '../sanitizer/sanitize.js';
import { projectDir } from '../dirs/project.js';

export interface BuildInput {
  projectRoot: string;
  marks: Mark[];
  artifacts?: Artifact[];
  source: Source;
  plaintext: string;
}

export async function buildHandprint(input: BuildInput): Promise<{
  hash: string;
  handprint: HandprintObject;
}> {

  const hpDir = projectDir(input.projectRoot);
  if (!existsSync(hpDir)) {
    throw new Error('not initialized: run "handprint init" first');
  }

  const seed = loadSeed();
  const kp = await deriveKeypair(seed);
  const encKey = await deriveEncryptionKey(seed);

  const sanitized = sanitize(input.plaintext);
  const payload = await encrypt(sanitized, encKey);

  // marks, artifacts, and source are stored in cleartext (only the payload is
  // encrypted), so scrub secrets/PII out of those fields too before writing.
  const marks = input.marks.map((m) => ({ ...m, note: sanitize(m.note) }));
  const artifacts = (input.artifacts ?? []).map((a) => ({
    ...a,
    uri: sanitize(a.uri),
  }));

  const currentHead = getRef(hpDir, 'HEAD');

  const unsigned: Omit<HandprintObject, 'sig'> = {
    v: HANDPRINT_OBJECT_VERSION,
    ts: new Date().toISOString(),
    marks,
    artifacts,
    source: input.source,
    payload,
    parent: currentHead,
    pubkey: toBase64url(kp.publicKey),
  };

  const canonical = canonicalize(unsigned);
  const digest = blake2b256(new TextEncoder().encode(canonical));
  const sig = await signDetached(digest, kp.privateKey);

  const handprint: HandprintObject = {
    ...unsigned,
    sig: toBase64url(sig),
  };

  const hash = await writeObject(hpDir, handprint);

  setRef(hpDir, 'HEAD', hash);
  appendFileSync(join(hpDir, 'log'), hash + '\n', 'utf-8');

  return { hash, handprint };
}
