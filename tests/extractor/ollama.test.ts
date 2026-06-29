// tests/extractor/openai.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOllamaProvider } from '../../src/extractor/ollama.js';
import { resolveProvider } from '../../src/extractor/index.js';

const BASE_URL = 'http://localhost:11434/v1';
const MODEL = 'qwen2.5:3b';

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}


beforeEach(() => {
  vi.restoreAllMocks();
});

describe('createOllamaProvider - preflight', () => {
  it('returns ok:true when /models returns 200', async () => {
    let capturedUrl = '';
    vi.stubGlobal('fetch', async (url: unknown, _init?: unknown) => {
      capturedUrl = String(url);
      return { ok: true, status: 200, json: async () => ({ data: [] }) };
    });

    const provider = createOllamaProvider({ baseUrl: BASE_URL, model: MODEL });
    const result = await provider.preflight!();
    expect(result.ok).toBe(true);
    expect(capturedUrl).toBe(`${BASE_URL}/models`);
  });

  it('returns ok:false with reason when /models returns non-2xx', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 503, json: async () => ({}) }));

    const provider = createOllamaProvider({ baseUrl: BASE_URL, model: MODEL });
    const result = await provider.preflight!();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(BASE_URL);
    expect(result.reason).toContain('ollama serve');
  });

  it('returns ok:false with reason when fetch rejects', async () => {
    vi.stubGlobal('fetch', async () => Promise.reject(new Error('ECONNREFUSED')));

    const provider = createOllamaProvider({ baseUrl: BASE_URL, model: MODEL });
    const result = await provider.preflight!();
    expect(result.ok).toBe(false);
    expect(result.reason).toContain(BASE_URL);
  });
});

describe('createOllamaProvider - extract', () => {
  it('POSTs to /chat/completions with model + system + user messages', async () => {
    const marks = [{ type: 'choice', subtype: 'override', note: 'chose Drizzle over Prisma' }];
    const chatResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify([
              { marks, artifacts: [], timestamp: '2026-06-01T12:00:00Z' },
            ]),
          },
        },
      ],
    };

    let capturedPostUrl = '';
    let capturedPostBody: unknown;
    let capturedHasAuthHeader = false;

    vi.stubGlobal('fetch', async (url: unknown, init?: unknown) => {
      const urlStr = String(url);
      if (urlStr.endsWith('/models')) {
        return { ok: true, status: 200, json: async () => ({ data: [] }) };
      }
      capturedPostUrl = urlStr;
      if (isRecord(init) && typeof init['body'] === 'string') {
        capturedPostBody = JSON.parse(init['body']);
      }
      if (isRecord(init) && isRecord(init['headers']) && 'authorization' in init['headers']) {
        capturedHasAuthHeader = true;
      }
      return { ok: true, status: 200, json: async () => chatResponse };
    });

    const provider = createOllamaProvider({ baseUrl: BASE_URL, model: MODEL });
    const extractions = await provider.extract('some window text', 'system prompt here');

    expect(capturedPostUrl).toBe(`${BASE_URL}/chat/completions`);

    // Verify body shape
    if (
      isRecord(capturedPostBody) &&
      Array.isArray(capturedPostBody['messages']) &&
      typeof capturedPostBody['model'] === 'string'
    ) {
      expect(capturedPostBody['model']).toBe(MODEL);
      expect(capturedPostBody['temperature']).toBe(0);
      expect(capturedPostBody['stream']).toBe(false);
      const msgs = capturedPostBody['messages'];
      expect(isRecord(msgs[0]) && msgs[0]['role']).toBe('system');
      expect(isRecord(msgs[0]) && msgs[0]['content']).toBe('system prompt here');
      expect(isRecord(msgs[1]) && msgs[1]['role']).toBe('user');
    } else {
      expect.fail('POST body missing expected fields');
    }

    // Verify parsed output
    expect(extractions).toHaveLength(1);
    expect(extractions[0].marks[0].note).toBe('chose Drizzle over Prisma');

    // No auth header without apiKey
    expect(capturedHasAuthHeader).toBe(false);
  });

  it('sends Authorization header when apiKey is provided', async () => {
    const chatResponse = {
      choices: [
        {
          message: {
            content: JSON.stringify([
              {
                marks: [{ type: 'choice', subtype: 'override', note: 'x' }],
                artifacts: [],
                timestamp: '2026-06-01T00:00:00Z',
              },
            ]),
          },
        },
      ],
    };

    let capturedAuthHeader: string | undefined;

    vi.stubGlobal('fetch', async (_url: unknown, init?: unknown) => {
      if (isRecord(init) && isRecord(init['headers'])) {
        const auth = init['headers']['authorization'];
        if (typeof auth === 'string') {
          capturedAuthHeader = auth;
        }
      }
      return { ok: true, status: 200, json: async () => chatResponse };
    });

    const provider = createOllamaProvider({ baseUrl: BASE_URL, model: MODEL, apiKey: 'sk-test' });
    await provider.extract('window', 'system');

    expect(capturedAuthHeader).toBe('Bearer sk-test');
  });

  it('throws on non-2xx from chat/completions', async () => {
    vi.stubGlobal('fetch', async () => ({ ok: false, status: 500, json: async () => ({}) }));
    const provider = createOllamaProvider({ baseUrl: BASE_URL, model: MODEL });
    await expect(provider.extract('w', 's')).rejects.toThrow('500');
  });
});

describe('resolveProvider - ollama', () => {
  it('resolves to openai provider when config.provider=ollama', () => {
    const provider = resolveProvider({
      config: { provider: 'ollama', baseUrl: 'http://x/v1', model: 'm' },
    });
    expect(provider.id).toBe('ollama');
  });

  it('ollama provider label includes model name', () => {
    const provider = resolveProvider({
      config: { provider: 'ollama', baseUrl: 'http://x/v1', model: 'my-model' },
    });
    expect(provider.label()).toBe('ollama:my-model');
  });
});
