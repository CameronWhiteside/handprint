export enum ResolutionStatus {
  Validated = "validated",
  Partial = "partial",
  Revised = "revised",
  Invalidated = "invalidated",
}

export interface Resolution {
  handprintHash: string;
  status: ResolutionStatus;
  body: string;
  learnings: string[];
  timestamp: string;
  author: string;
}

export interface CreateResolutionInput {
  handprintHash: string;
  status: ResolutionStatus;
  body: string;
  learnings?: string[];
  author?: string;
}

const VALID_STATUSES = new Set<string>(Object.values(ResolutionStatus));

export function createResolution(input: CreateResolutionInput): Resolution {
  return {
    handprintHash: input.handprintHash,
    status: input.status,
    body: input.body,
    learnings: input.learnings ?? [],
    timestamp: new Date().toISOString(),
    author: input.author ?? "unknown",
  };
}

export function validateResolution(res: Resolution): string[] {
  const errors: string[] = [];

  if (!res.handprintHash) {
    errors.push("handprintHash is required");
  }
  if (!VALID_STATUSES.has(res.status)) {
    errors.push(
      "status must be one of: " + [...VALID_STATUSES].join(", "),
    );
  }
  if (!res.body) {
    errors.push("body is required");
  }

  return errors;
}
