// src/extractor/local-model.ts
import { createWriteStream, mkdirSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { buildUserPrompt } from './prompt.js';
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

      // node-llama-cpp is an optional dependency (large native binaries). Lazy
      // import keeps it off the hot path and lets us give a clear hint if a
      // local-model user never installed it.
      const llamaModule = await import('node-llama-cpp').catch(() => {
        throw new Error(
          'the local model needs node-llama-cpp, which is not installed.\n' +
            'install it once with:  npm i -g node-llama-cpp\n' +
            'or switch to a host agent:  handprint config set extraction.provider host',
        );
      });
      const { getLlama, LlamaChatSession } = llamaModule;
      const llama = await getLlama();
      const model = await llama.loadModel({ modelPath: modelPath(entry, opts.homeDir) });
      const context = await model.createContext();
      const grammar = await llama.createGrammar({ grammar: EXTRACTION_GBNF });
      const session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: system });
      const prompt = buildUserPrompt(window);
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
