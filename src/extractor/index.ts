// src/extractor/index.ts
import type { ExtractionConfig } from '@handprint/types';
import type { TranscriptEntry } from '../sources/types.js';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { chunkEntries, buildConversationWindow, buildChunkPlaintext } from './window.js';
import { createLocalProvider, type LocalProviderOpts } from './local-model.js';
import { createHostProvider } from './host-agent.js';
import { DEFAULT_MODEL_ID } from './models.js';

export * from './types.js';
export { MODELS, DEFAULT_MODEL_ID } from './models.js';

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

export interface ExtractProgress {
  /** Called before each chunk is sent to the model: (chunkNumber, totalChunks, messages). */
  onChunk?: (chunkNumber: number, totalChunks: number, messages: number) => void;
}

export async function extractFromEntries(
  entries: TranscriptEntry[],
  provider: ExtractorProvider,
  progress: ExtractProgress = {},
): Promise<RawExtraction[]> {
  const chunks = chunkEntries(entries);
  const all: RawExtraction[] = [];
  let attempted = 0;
  let errored = 0;
  let lastMsg = '';
  for (let i = 0; i < chunks.length; i++) {
    const window = buildConversationWindow(chunks[i]);
    if (!window.trim()) continue;
    attempted++;
    progress.onChunk?.(i + 1, chunks.length, chunks[i].length);
    try {
      const out = await provider.extract(window, SYSTEM_PROMPT);
      const pt = buildChunkPlaintext(chunks[i]);
      for (const e of out) e.sourcePlaintext = pt;
      all.push(...out);
    } catch (err) {
      errored++;
      const msg = err instanceof Error ? err.message : String(err);
      lastMsg = msg;
      console.error(`  chunk ${i + 1} error: ${msg}`);
    }
  }
  if (attempted > 0 && errored === attempted) {
    throw new Error(`extraction failed for all ${attempted} chunks (last error: ${lastMsg})`);
  }
  return all;
}

