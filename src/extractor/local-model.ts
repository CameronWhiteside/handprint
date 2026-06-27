// src/extractor/local-model.ts
import { createWriteStream, mkdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { EXTRACTION_GBNF } from './grammar.js';
import {
  type ModelEntry,
  modelById,
  modelPath,
  modelsDir,
  isModelDownloaded,
} from './models.js';

export interface LocalProviderOpts {
  modelId: string;
  homeDir?: string;
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
}

const isWebReadableStream = (v: unknown): v is WebReadableStream<Uint8Array> =>
  v !== null && typeof v === 'object' && 'getReader' in v;

export async function ensureModel(
  entry: ModelEntry,
  homeDir: string | undefined,
  onDownload?: (entry: ModelEntry) => Promise<boolean>,
): Promise<boolean> {
  if (isModelDownloaded(entry, homeDir)) return true;
  if (!onDownload) return false;
  const consent = await onDownload(entry);
  if (!consent) return false;
  mkdirSync(modelsDir(homeDir), { recursive: true });
  const res = await fetch(entry.url);
  if (!res.ok || !res.body) {
    throw new Error(`model download failed (${res.status}) for ${entry.id}`);
  }
  if (!isWebReadableStream(res.body)) {
    throw new Error(`unexpected response body type for ${entry.id}`);
  }
  const dest = createWriteStream(modelPath(entry, homeDir));
  await pipeline(Readable.fromWeb(res.body), dest);
  return true;
}

export function createLocalProvider(opts: LocalProviderOpts): ExtractorProvider {
  const entry = modelById(opts.modelId);
  if (!entry) throw new Error(`unknown model: ${opts.modelId}`);

  return {
    id: 'local-model',
    label: () => `local:${entry.id}`,

    async isAvailable(): Promise<boolean> {
      if (isModelDownloaded(entry, opts.homeDir)) return true;
      if (!opts.onDownload) return false;
      return ensureModel(entry, opts.homeDir, opts.onDownload);
    },

    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const ready = await ensureModel(entry, opts.homeDir, opts.onDownload);
      if (!ready) throw new Error('local model not available — run "handprint grab" to download it');

      // Lazy import keeps the native module off the hot path for non-local runs.
      const { getLlama, LlamaChatSession } = await import('node-llama-cpp');
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: modelPath(entry, opts.homeDir) });
      const context = await model.createContext();
      const grammar = await llama.createGrammar({ grammar: EXTRACTION_GBNF });
      const session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: system });
      const prompt = `Analyze this conversation and extract any handprints (human decision moments):\n\n${window}`;
      let answer: string;
      try {
        answer = await session.prompt(prompt, { grammar, maxTokens: 4096 });
      } finally {
        await context.dispose();
        await model.dispose();
      }
      return parseExtractionJson(answer);
    },
  };
}
