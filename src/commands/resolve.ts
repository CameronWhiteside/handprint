import { appendFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { writeObject, readObject } from "../store/objects.js";
import { createResolution } from "../model/resolution.js";
import type { ResolutionStatus } from "../model/resolution.js";
import { showHandprint } from "./show.js";
import { HANDPRINT_DIR } from "./init.js";

export interface ResolveInput {
  handprintRef: string;
  status: ResolutionStatus;
  body: string;
  learnings?: string[];
}

/**
 * Resolves a handprint by creating a resolution object, updating the
 * handprint's status to "resolved", and appending the resolution hash
 * to the resolutions index.
 *
 * Throws if the handprint ref cannot be found.
 * Returns the SHA-256 hash of the resolution object.
 */
export function resolveHandprint(
  repoRoot: string,
  input: ResolveInput,
): string {
  const hp = showHandprint(repoRoot, input.handprintRef);
  if (!hp) {
    throw new Error(`handprint not found: ${input.handprintRef}`);
  }

  const hpDir = join(repoRoot, HANDPRINT_DIR);

  // Create and persist the resolution object
  const resolution = createResolution({
    handprintHash: hp.hash,
    status: input.status,
    body: input.body,
    learnings: input.learnings,
  });

  const resHash = writeObject(
    hpDir,
    resolution as unknown as Record<string, unknown>,
  );

  // Append resolution hash to the resolutions index
  appendFileSync(join(hpDir, "resolutions"), resHash + "\n", "utf-8");

  // Update the handprint's status in place
  const hpObj = readObject(hpDir, hp.hash);
  if (hpObj) {
    hpObj.status = "resolved";
    const prefix = hp.hash.slice(0, 2);
    const rest = hp.hash.slice(2);
    const filePath = join(hpDir, "objects", prefix, rest);
    writeFileSync(filePath, JSON.stringify(hpObj), "utf-8");
  }

  return resHash;
}
