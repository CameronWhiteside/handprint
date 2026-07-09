import { describe, it, expect, vi, afterEach } from 'vitest';
import { createAnthropicProvider } from '../../src/extractor/anthropic.js';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('createAnthropicProvider', () => {
  it('fails preflight without an api key', async () => {
    const p = createAnthropicProvider({});
    const pf = await p.preflight!();
    expect(pf.ok).toBe(false);
    expect(pf.reason).toMatch(/api key/i);
  });

  it('sends a cache_control system block and parses the response', async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      // system is a cache_control block, not a bare string
      expect(body.system[0].cache_control).toEqual({ type: 'ephemeral' });
      expect(body.system[0].text).toContain('SYSTEM');
      return new Response(
        JSON.stringify({
          content: [
            {
              type: 'text',
              text: '[{"marks":[{"type":"choice","subtype":"override","note":"Postgres over Mongo"}],"artifacts":[],"timestamp":"2026-07-03T18:00:00Z"}]',
            },
          ],
        }),
        { status: 200 }
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const p = createAnthropicProvider({ apiKey: 'sk-ant-test', model: 'claude-haiku-4-5-20251001' });
    const out = await p.extract('some window', 'SYSTEM PROMPT');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(out).toHaveLength(1);
    expect(out[0].marks[0]).toMatchObject({ type: 'choice', subtype: 'override' });
  });

  it('throws on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const p = createAnthropicProvider({ apiKey: 'sk-ant-test' });
    await expect(p.extract('w', 's')).rejects.toThrow(/Anthropic API 401/);
  });
});
