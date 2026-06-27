import { ALL_ADAPTERS } from '../sources/index.js';
import type { SourceCapabilities } from '../sources/types.js';

export interface SourceRow {
  id: string;
  displayName: string;
  sourceAgent: string;
  implemented: boolean;
  locations: string[];
  sessions: number;
  capabilities: SourceCapabilities;
}

export function listSources(opts?: { homeDir?: string }): SourceRow[] {
  return ALL_ADAPTERS.map((a) => {
    let sessions = 0;
    if (a.descriptor.implemented) {
      try {
        sessions = a.locate({ homeDir: opts?.homeDir }).length;
      } catch {
        sessions = 0;
      }
    }
    return {
      id: a.descriptor.id,
      displayName: a.descriptor.displayName,
      sourceAgent: a.descriptor.sourceAgent,
      implemented: a.descriptor.implemented,
      locations: a.descriptor.locations,
      sessions,
      capabilities: a.descriptor.capabilities,
    };
  });
}
