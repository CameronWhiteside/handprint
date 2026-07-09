// src/extractor/anthropic.ts
//
// Native Anthropic Messages API extractor. Unlike the OpenAI-compatible path,
// this puts the (large, unchanging) system prompt in a cache_control block, so
// after the first call the taxonomy + examples are served from Anthropic's
// prompt cache — ~90% cheaper on reads and no re-billing to resend the full
// prompt every chunk. Uses your Anthropic API key (pay-per-token), not a Claude
// subscription; for the free/subscription path use `--extractor host`.
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { buildUserPrompt } from './prompt.js';

export const ANTHROPIC_BASE_URL = 'https://api.anthropic.com/v1';
export const DEFAULT_ANTHROPIC_MODEL = 'claude-haiku-4-5-20251001';
const ANTHROPIC_VERSION = '2023-06-01';
const MAX_TOKENS = 4096;

export interface AnthropicProviderOpts {
  apiKey?: string;
  model?: string;
  baseUrl?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

// Messages API returns { content: [{ type: 'text', text: '...' }, ...] }.
function extractText(json: unknown): string | null {
  if (!isRecord(json)) return null;
  const content = json['content'];
  if (!Array.isArray(content)) return null;
  const parts: string[] = [];
  for (const block of content) {
    if (isRecord(block) && block['type'] === 'text' && typeof block['text'] === 'string') {
      parts.push(block['text']);
    }
  }
  return parts.length > 0 ? parts.join('') : null;
}

export function createAnthropicProvider(opts: AnthropicProviderOpts): ExtractorProvider {
  const model = opts.model ?? DEFAULT_ANTHROPIC_MODEL;
  const baseUrl = opts.baseUrl ?? ANTHROPIC_BASE_URL;
  const apiKey = opts.apiKey;

  const missingKeyReason =
    'No Anthropic API key. Set one with:\n' +
    '  handprint config set extraction.apiKey <sk-ant-...> --global\n' +
    '  (or use --extractor host to run on your Claude subscription instead)';

  return {
    id: 'anthropic',
    label: () => `anthropic:${model}`,

    async preflight(): Promise<{ ok: boolean; reason?: string }> {
      return apiKey ? { ok: true } : { ok: false, reason: missingKeyReason };
    },

    async isAvailable(): Promise<boolean> {
      return Boolean(apiKey);
    },

    async extract(window: string, system: string): Promise<RawExtraction[]> {
      if (!apiKey) throw new Error(missingKeyReason);

      const body = JSON.stringify({
        model,
        max_tokens: MAX_TOKENS,
        temperature: 0,
        // The system prompt is identical across every chunk, so cache it: the
        // first call writes the cache, the rest read it (~90% cheaper).
        system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
        messages: [{ role: 'user', content: buildUserPrompt(window) }],
      });

      const res = await fetch(`${baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new Error(`Anthropic API ${res.status} at ${baseUrl}/messages: ${detail.slice(0, 200)}`);
      }

      const json: unknown = await res.json();
      const text = extractText(json);
      if (text === null) {
        throw new Error('unexpected Anthropic response shape: no text content block');
      }
      return parseExtractionJson(text);
    },
  };
}
