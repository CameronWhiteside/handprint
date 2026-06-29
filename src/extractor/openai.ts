// src/extractor/openai.ts
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { buildUserPrompt } from './prompt.js';

export interface OpenAIProviderOpts {
  baseUrl: string;
  model: string;
  apiKey?: string;
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function isChoice(v: unknown): v is { message: { content: string } } {
  if (!isRecord(v)) return false;
  const msg = v['message'];
  if (!isRecord(msg)) return false;
  return typeof msg['content'] === 'string';
}

function isCompletionResponse(v: unknown): v is { choices: Array<{ message: { content: string } }> } {
  if (!isRecord(v)) return false;
  const choices = v['choices'];
  return Array.isArray(choices) && choices.length > 0 && isChoice(choices[0]);
}

export function createOpenAIProvider(opts: OpenAIProviderOpts): ExtractorProvider {
  const { baseUrl, model, apiKey } = opts;

  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (apiKey) {
    headers['authorization'] = `Bearer ${apiKey}`;
  }

  const preflightFailReason =
    `No local OpenAI-compatible server reachable at ${baseUrl}.\n` +
    `  start one, e.g.  ollama serve   then   ollama pull ${model}\n` +
    `  or set a different server:  handprint config set extraction.baseUrl <url> --global\n` +
    `  or use your agent:  handprint grab --extractor host`;

  return {
    id: 'openai',
    label: () => `openai:${model}`,

    async preflight(): Promise<{ ok: boolean; reason?: string }> {
      try {
        const res = await fetch(`${baseUrl}/models`, { signal: AbortSignal.timeout(2000) });
        if (res.ok) return { ok: true };
        return { ok: false, reason: preflightFailReason };
      } catch {
        return { ok: false, reason: preflightFailReason };
      }
    },

    async isAvailable(): Promise<boolean> {
      const pf = await this.preflight!();
      return pf.ok;
    },

    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const body = JSON.stringify({
        model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: buildUserPrompt(window) },
        ],
        temperature: 0,
        stream: false,
      });

      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body,
      });

      if (!res.ok) {
        throw new Error(`OpenAI-compatible server returned ${res.status} for ${baseUrl}/chat/completions`);
      }

      const json: unknown = await res.json();

      if (!isCompletionResponse(json)) {
        throw new Error('unexpected response shape from OpenAI-compatible server: missing choices[0].message.content');
      }

      const content = json.choices[0].message.content;
      return parseExtractionJson(content);
    },
  };
}
