// src/extractor/index.ts
import type { ExtractionConfig, Artifact } from '@handprint/types';
import type { TranscriptEntry } from '../sources/types.js';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { chunkEntries, buildConversationWindow, buildChunkPlaintext } from './window.js';
import { createLocalProvider, type LocalProviderOpts } from './local-model.js';
import { createHostProvider, detectAgentCli } from './host-agent.js';
import { createOllamaProvider } from './ollama.js';
import { createAnthropicProvider } from './anthropic.js';
import { DEFAULT_MODEL_ID } from './models.js';
import { dedupeMarks } from './dedupe.js';
import { mergeArtifacts } from './infer-artifact.js';

/** Run an async fn over items with a bounded number in flight at once. */
async function mapPool<T>(items: T[], limit: number, fn: (item: T) => Promise<void>): Promise<void> {
  let idx = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (idx < items.length) {
      const cur = idx++;
      await fn(items[cur]);
    }
  });
  await Promise.all(workers);
}

export * from './types.js';
export { MODELS, DEFAULT_MODEL_ID } from './models.js';

export const OLLAMA_DEFAULT_BASE_URL = 'http://localhost:11434/v1';
export const DEFAULT_OLLAMA_MODEL = 'qwen2.5:3b';

export interface ResolveOpts {
  config?: ExtractionConfig;
  homeDir?: string;
  onDownload?: LocalProviderOpts['onDownload'];
  forceProvider?: 'local' | 'host' | 'ollama' | 'openai' | 'anthropic';
  /** Detect whether a host agent CLI is on PATH (default: a real probe). Injectable for tests. */
  detectHost?: () => boolean;
}

export function resolveProvider(opts: ResolveOpts = {}): ExtractorProvider {
  // Default when nothing is configured: prefer the host agent CLI (fast, no
  // multi-GB model download, no slow CPU inference) whenever one is on PATH —
  // most handprint users already have claude installed. Fall back to the local
  // model only when there's no agent CLI to defer to. An explicit --extractor
  // or a configured provider always wins.
  const hostAvailable = opts.detectHost ?? (() => detectAgentCli() !== undefined);
  const provider = opts.forceProvider ?? opts.config?.provider ?? (hostAvailable() ? 'host' : 'local');
  if (provider === 'host') {
    return createHostProvider({ cli: opts.config?.agentCli, model: opts.config?.model });
  }
  if (provider === 'anthropic') {
    return createAnthropicProvider({ apiKey: opts.config?.apiKey, model: opts.config?.model, baseUrl: opts.config?.baseUrl });
  }
  if (provider === 'ollama' || provider === 'openai') {
    return createOllamaProvider({
      baseUrl: opts.config?.baseUrl ?? OLLAMA_DEFAULT_BASE_URL,
      model: opts.config?.model ?? DEFAULT_OLLAMA_MODEL,
      apiKey: opts.config?.apiKey,
    });
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
  /** Called after each chunk's extraction settles (success or error). */
  onChunkDone?: () => void;
  /** Max chunks extracted in parallel (default 1). Keep at 1 for the local
   *  llama provider — its single context is not concurrency-safe. */
  concurrency?: number;
  /** Infer a chunk's work artifacts from its entries; merged into each
   *  extraction the chunk produces (deduped by uri). */
  resolveArtifacts?: (entries: TranscriptEntry[]) => Artifact[];
}

export async function extractFromEntries(
  entries: TranscriptEntry[],
  provider: ExtractorProvider,
  progress: ExtractProgress = {},
): Promise<RawExtraction[]> {
  const chunks = chunkEntries(entries).filter((c) => buildConversationWindow(c).trim());
  const total = chunks.length;
  if (total === 0) return [];

  const results: RawExtraction[][] = new Array(total).fill(null).map(() => []);
  let attempted = 0;
  let errored = 0;
  let lastMsg = '';

  const runChunk = async (i: number): Promise<boolean> => {
    const chunkEntries = chunks[i];
    const window = buildConversationWindow(chunkEntries);
    progress.onChunk?.(i + 1, total, chunkEntries.length);
    try {
      const out = await provider.extract(window, SYSTEM_PROMPT);
      const pt = buildChunkPlaintext(chunkEntries);
      const inferred = progress.resolveArtifacts?.(chunkEntries) ?? [];
      for (const e of out) {
        e.sourcePlaintext = pt;
        if (inferred.length) e.artifacts = mergeArtifacts(e.artifacts, inferred);
      }
      results[i] = out;
      return true;
    } catch (err) {
      errored++;
      lastMsg = err instanceof Error ? err.message : String(err);
      console.error(`  chunk ${i + 1} error: ${lastMsg}`);
      return false;
    } finally {
      progress.onChunkDone?.();
    }
  };

  // Fail fast: run the first chunk alone. A first-chunk failure is almost always
  // systemic (wrong engine, missing runtime, unparseable output), so stop now
  // instead of grinding through every chunk and session before reporting zero.
  attempted++;
  const firstOk = await runChunk(0);
  if (!firstOk) {
    throw new Error(
      `extraction failed on the first chunk (${lastMsg}). Stopping early. ` +
        `Run with HANDPRINT_DEBUG=1 to see the model output, or try a different --extractor.`,
    );
  }

  // Remaining chunks in a bounded pool (concurrency 1 = serial, as before).
  if (total > 1) {
    const rest = Array.from({ length: total - 1 }, (_, k) => k + 1);
    await mapPool(rest, progress.concurrency ?? 1, async (i) => {
      attempted++;
      await runChunk(i);
    });
  }

  if (attempted > 0 && errored === attempted) {
    throw new Error(`extraction failed for all ${attempted} chunks (last error: ${lastMsg})`);
  }
  // Dedupe near-duplicate marks ACROSS this session's chunks (same decision,
  // re-described in a later chunk shouldn't produce a second chip).
  return dedupeMarks(results.flat());
}

