import { execSync } from "node:child_process";

export enum HandprintType {
  Vision = "vision",
  Choice = "choice",
  Method = "method",
}

export interface Anchor {
  label: string;
  verified: boolean;
}

export interface Handprint {
  type: HandprintType;
  intent: string;
  risk: string;
  context: string;
  timestamp: string;
  author: string;
  horizon: string | null;
  confidence: number | null;
  source: string | null;
  anchors: Anchor[];
  status: "open" | "resolved";
  parent: string | null;
}

export interface CreateHandprintInput {
  type: HandprintType;
  intent: string;
  risk: string;
  context: string;
  horizon?: string | null;
  confidence?: number | null;
  source?: string | null;
  anchors?: Anchor[];
  author?: string;
  parent?: string | null;
}

function currentAuthor(): string {
  try {
    const name = execSync("git config user.name", { encoding: "utf-8" }).trim();
    const email = execSync("git config user.email", {
      encoding: "utf-8",
    }).trim();
    if (name && email) return `${name} <${email}>`;
    if (name) return name;
    if (email) return email;
    return "unknown";
  } catch {
    return "unknown";
  }
}

const VALID_TYPES = new Set<string>(Object.values(HandprintType));

export function createHandprint(input: CreateHandprintInput): Handprint {
  return {
    type: input.type,
    intent: input.intent,
    risk: input.risk,
    context: input.context,
    timestamp: new Date().toISOString(),
    author: input.author ?? currentAuthor(),
    horizon: input.horizon ?? null,
    confidence: input.confidence ?? null,
    source: input.source ?? null,
    anchors: input.anchors ?? [],
    status: "open",
    parent: input.parent ?? null,
  };
}

export function validateHandprint(hp: Handprint): string[] {
  const errors: string[] = [];

  if (!VALID_TYPES.has(hp.type)) {
    errors.push("type must be one of: " + [...VALID_TYPES].join(", "));
  }
  if (!hp.intent) {
    errors.push("intent is required");
  }
  if (!hp.risk) {
    errors.push("risk is required");
  }
  if (!hp.context) {
    errors.push("context is required");
  }
  if (!hp.timestamp) {
    errors.push("timestamp is required");
  }

  return errors;
}
