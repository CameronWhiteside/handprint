// src/extractor/index.ts
import type { ExtractionConfig } from '@handprint/types';
import type { TranscriptEntry } from '../sources/types.js';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { SYSTEM_PROMPT } from './types.js';
import { chunkEntries, buildConversationWindow } from './window.js';
import { createLocalProvider, type LocalProviderOpts } from './local-model.js';
import { createHostProvider } from './host-agent.js';
import { DEFAULT_MODEL_ID, type ModelEntry } from './models.js';

export * from './types.js';
export { MODELS, DEFAULT_MODEL_ID, modelById, isModelDownloaded } from './models.js';
export { detectAgentCli } from './host-agent.js';

export interface ResolveOpts {
  config?: ExtractionConfig;
  homeDir?: string;
  onDownload?: LocalProviderOpts['onDownload'];
  forceProvider?: 'local' | 'host';
}

export function resolveProvider(opts: ResolveOpts = {}): ExtractorProvider {
  const provider = opts.forceProvider ?? opts.config?.provider ?? 'local';
  if (provider === 'host') {
    return createHostProvider({ cli: opts.config?.agentCli });
  }
  return createLocalProvider({
    modelId: opts.config?.model ?? DEFAULT_MODEL_ID,
    homeDir: opts.homeDir,
    onDownload: opts.onDownload,
  });
}

export async function extractFromEntries(
  entries: TranscriptEntry[],
  provider: ExtractorProvider,
): Promise<RawExtraction[]> {
  const chunks = chunkEntries(entries);
  const all: RawExtraction[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const window = buildConversationWindow(chunks[i]);
    if (!window.trim()) continue;
    console.error(`  chunk ${i + 1}/${chunks.length} (${chunks[i].length} messages)...`);
    try {
      const out = await provider.extract(window, SYSTEM_PROMPT);
      all.push(...out);
    } catch (err) {
      console.error(`  chunk ${i + 1} error: ${(err as Error).message}`);
    }
  }
  return all;
}

export type { ModelEntry };
