import { existsSync, appendFileSync } from "node:fs";
import { join } from "node:path";
import { writeObject } from "../store/objects.js";
import { createHandprint, HandprintType } from "../model/handprint.js";
import type { Anchor } from "../model/handprint.js";
import { HANDPRINT_DIR } from "./init.js";

export interface SealInput {
  type: HandprintType;
  intent: string;
  risk: string;
  context: string;
  horizon?: string | null;
  confidence?: number | null;
  source?: string | null;
  anchors?: Anchor[];
}

/**
 * Seals a handprint: creates the record, persists it to the object store,
 * and appends its hash to the log index.
 *
 * Throws if the handprint store has not been initialized.
 * Returns the SHA-256 hash of the sealed handprint.
 */
export function sealHandprint(repoRoot: string, input: SealInput): string {
  const hpDir = join(repoRoot, HANDPRINT_DIR);

  if (!existsSync(hpDir)) {
    throw new Error("not initialized");
  }

  const hp = createHandprint(input);
  const hash = writeObject(hpDir, hp as unknown as Record<string, unknown>);

  appendFileSync(join(hpDir, "log"), hash + "\n", "utf-8");

  return hash;
}
