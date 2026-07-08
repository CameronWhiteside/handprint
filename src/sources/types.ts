// src/sources/types.ts
export interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: string; // ISO 8601
  cwd: string;
  sessionId: string;
  gitBranch: string;
  /** Absolute file paths touched in this message's tool calls, if any. Used to
   *  attribute the handprint to the repo it changed (not just where it ran). */
  paths?: string[];
}

export interface SessionRef {
  sourceId: string;
  sessionId: string;
  project: string;
  locator: string;
  mtimeMs: number;
}

export interface NormalizedSession {
  ref: SessionRef;
  entries: TranscriptEntry[];
}

export interface SourceCapabilities {
  timestamps: 'iso' | 'epoch-ms' | 'none';
  session: boolean;
  project: boolean;
  gitBranch: boolean;
  model: boolean;
}

interface SourceDescriptor {
  id: 'claude-code' | 'opencode' | 'codex' | 'cursor';
  displayName: string;
  sourceAgent: string;
  capabilities: SourceCapabilities;
  locations: string[];
  implemented: boolean;
}

export interface LocateOpts {
  homeDir?: string;
}

export interface SourceAdapter {
  descriptor: SourceDescriptor;
  locate(opts?: LocateOpts): SessionRef[];
  parse(ref: SessionRef): NormalizedSession;
}

export class NotImplementedError extends Error {
  constructor(sourceId: string) {
    super(
      `source adapter "${sourceId}" is not implemented yet, see docs/CONTRIBUTING.md`,
    );
    this.name = 'NotImplementedError';
  }
}
