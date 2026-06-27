// src/sources/codex.ts
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SourceAdapter, SessionRef, NormalizedSession, LocateOpts } from './types.js';
import { NotImplementedError } from './types.js';

export const codexAdapter: SourceAdapter = {
  descriptor: {
    id: 'codex',
    displayName: 'Codex CLI',
    sourceAgent: 'codex',
    capabilities: { timestamps: 'iso', session: true, project: true, gitBranch: false, model: true },
    locations: ['~/.codex/sessions'],
    implemented: false,
  },
  locate(_opts?: LocateOpts): SessionRef[] {
    // Sessions live under ~/.codex/sessions; enumeration is wired here once the
    // on-disk format is confirmed. Until then discovery skips this source.
    void join(homedir(), '.codex', 'sessions');
    return [];
  },
  parse(_ref: SessionRef): NormalizedSession {
    throw new NotImplementedError('codex');
  },
};
