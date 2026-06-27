// src/sources/cursor.ts
import { join } from 'node:path';
import { homedir } from 'node:os';
import type { SourceAdapter, SessionRef, NormalizedSession, LocateOpts } from './types.js';
import { NotImplementedError } from './types.js';

export const cursorAdapter: SourceAdapter = {
  descriptor: {
    id: 'cursor',
    displayName: 'Cursor',
    sourceAgent: 'cursor',
    capabilities: { timestamps: 'epoch-ms', session: true, project: true, gitBranch: false, model: true },
    locations: ['~/Library/Application Support/Cursor (SQLite state store)'],
    implemented: false,
  },
  locate(_opts?: LocateOpts): SessionRef[] {
    // Cursor persists chat in a SQLite store under its app-support dir; reading it
    // needs a sqlite dependency + schema mapping, wired in a follow-up.
    void join(homedir(), 'Library', 'Application Support', 'Cursor');
    return [];
  },
  parse(_ref: SessionRef): NormalizedSession {
    throw new NotImplementedError('cursor');
  },
};
