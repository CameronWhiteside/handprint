// src/extractor/local-model.ts
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { createWriteStream, createReadStream, mkdirSync, renameSync, unlinkSync } from 'node:fs';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as WebReadableStream } from 'node:stream/web';
import type { LlamaContextSequence, LlamaGrammar } from 'node-llama-cpp';
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
import { detectAgentCli, agentBrand } from './host-agent.js';

export interface LocalProviderOpts {
  modelId: string;
  homeDir?: string;
  onDownload?: (entry: ModelEntry) => Promise<boolean>;
}

const isWebReadableStream = (v: unknown): v is WebReadableStream<Uint8Array> =>
  v !== null && typeof v === 'object' && 'getReader' in v;

/** Stream-hash a file on disk and return its hex SHA-256 digest. */
async function hashFile(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  const stream = createReadStream(filePath);
  for await (const chunk of stream) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

/**
 * Decide model-download consent. `-y`/`--yes` and HANDPRINT_AUTO_DOWNLOAD=1 both
 * mean "yes to everything" (so scripted/agent runs work); an interactive TTY is
 * asked; anything else is denied (never download multi-GB unprompted).
 */
export function downloadConsent(input: {
  yes: boolean;
  autoDownloadEnv: string | undefined;
  isTty: boolean;
}): 'auto' | 'ask' | 'deny' {
  if (input.yes || input.autoDownloadEnv === '1') return 'auto';
  if (input.isTty) return 'ask';
  return 'deny';
}

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

  // Item 2: download to a temp path so a partial download never masquerades
  // as a complete model file that isModelDownloaded() would accept.
  const finalPath = modelPath(entry, homeDir);
  const tmpPath = `${finalPath}.tmp`;

  try {
    const res = await fetch(entry.url);
    if (!res.ok || !res.body) {
      throw new Error(`model download failed (${res.status}) for ${entry.id}`);
    }
    if (!isWebReadableStream(res.body)) {
      throw new Error(`unexpected response body type for ${entry.id}`);
    }
    const dest = createWriteStream(tmpPath);
    await pipeline(Readable.fromWeb(res.body), dest);

    if (entry.sha256) {
      // Item 2: verify integrity before promoting the temp file.
      const actual = await hashFile(tmpPath);
      if (actual !== entry.sha256) {
        unlinkSync(tmpPath);
        throw new Error(
          `sha256 mismatch for ${entry.id}: expected ${entry.sha256}, got ${actual}`,
        );
      }
    } else {
      // Item 2: warn when no pinned digest is available, do not silently skip.
      process.stderr.write(
        `note: ${entry.id} has no pinned checksum yet; downloaded over HTTPS.\n`,
      );
    }

    // Item 2: atomic rename, the final path is written only on success.
    renameSync(tmpPath, finalPath);
    return true;
  } catch (err) {
    // Item 2: ensure temp file is cleaned up on any error path.
    try {
      unlinkSync(tmpPath);
    } catch {
      // Already removed (e.g. after sha256 mismatch) or never created, ignore.
    }
    throw err;
  }
}

export function createLocalProvider(opts: LocalProviderOpts): ExtractorProvider {
  const entry = modelById(opts.modelId);
  if (!entry) throw new Error(`unknown model: ${opts.modelId}`);

  // Loading the model is the expensive part (seconds, plus a one-line log
  // warning from llama.cpp's tokenizer check). Cache it and the grammar and
  // sequence across extract() calls in this process instead of reloading
  // per chunk; only the chat history is reset between chunks.
  let ready: Promise<{ sequence: LlamaContextSequence; grammar: LlamaGrammar }> | undefined;

  return {
    id: 'local-model',
    label: () => `local:${entry.id}`,

    async preflight() {
      try {
        // Resolve (do NOT load) the module: confirms node-llama-cpp is installed
        // without executing its native addon, so a broken binary can't crash the
        // preflight and we never download a model we can't use.
        createRequire(import.meta.url).resolve('node-llama-cpp');
        return { ok: true };
      } catch {
        // If an agent CLI is already on PATH, name it so the user knows they
        // have a ready alternative without installing anything extra.
        const detected = detectAgentCli();
        const hostLine = detected
          ? `  or use your installed agent (${agentBrand(detected.id)}):  handprint grab --extractor host`
          : '  or use your agent:    handprint grab --extractor host';
        return {
          ok: false,
          reason:
            'Local extraction needs node-llama-cpp, a one-time install (it is not bundled).\n' +
            '  install it:           npm i -g node-llama-cpp\n' +
            hostLine + '\n' +
            '  or make host default: handprint config set extraction.provider host --global',
        };
      }
    },

    async isAvailable(): Promise<boolean> {
      if (isModelDownloaded(entry, opts.homeDir)) return true;
      if (!opts.onDownload) return false;
      return ensureModel(entry, opts.homeDir, opts.onDownload);
    },

    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const downloaded = await ensureModel(entry, opts.homeDir, opts.onDownload);
      if (!downloaded)
        throw new Error(
          'local model not downloaded, and no consent to download it.\n' +
            '  Re-run with -y (or set HANDPRINT_AUTO_DOWNLOAD=1) to auto-download,\n' +
            '  or run in an interactive terminal to confirm the download.',
        );

      // Model load takes seconds and logs a one-line tokenizer warning; do it
      // once per process and reuse across every chunk instead of per-extract().
      if (!ready) {
        ready = (async () => {
          // node-llama-cpp is not bundled or installed by default; local-model users
          // add it with `npm i -g node-llama-cpp`. Lazy import keeps it off the hot
          // path and lets us give a clear hint if it is missing.
          const llamaModule = await import('node-llama-cpp').catch(() => {
            throw new Error(
              'the local model needs node-llama-cpp, which is not installed.\n' +
                'install it once with:  npm i -g node-llama-cpp\n' +
                'or switch to a host agent:  handprint config set extraction.provider host',
            );
          });
          const { getLlama, LlamaLogLevel } = llamaModule;
          const llama = await getLlama({ logLevel: LlamaLogLevel.error });
          // Surface the backend so a slow run is diagnosable (CPU vs GPU offload).
          const backend = llama.gpu === false ? 'CPU' : llama.gpu;
          console.error(
            `[handprint] local backend: ${backend}` +
              (backend === 'CPU'
                ? ' — no GPU offload; CPU inference is slow. `--extractor host` is far faster.'
                : ''),
          );
          const model = await llama.loadModel({ modelPath: modelPath(entry, opts.homeDir) });
          const context = await model.createContext();
          const grammar = await llama.createGrammar({ grammar: EXTRACTION_GBNF });
          return { sequence: context.getSequence(), grammar };
        })();
      }
      const { sequence, grammar } = await ready;

      const llamaModule = await import('node-llama-cpp');
      const { LlamaChatSession } = llamaModule;
      // Each chunk is an independent extraction: reuse the loaded model/context
      // but dispose the chat history (not the sequence) after every call so
      // one chunk's content never leaks into the next chunk's prompt.
      const session = new LlamaChatSession({ contextSequence: sequence, systemPrompt: system });
      const prompt = buildUserPrompt(window);
      try {
        const answer = await session.prompt(prompt, { grammar, maxTokens: 4096 });
        return parseExtractionJson(answer);
      } finally {
        session.dispose({ disposeSequence: false });
      }
    },
  };
}
