import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHubClient } from '../../src/hub/client.js';

const mockFetch = vi.fn();
globalThis.fetch = mockFetch;

describe('hub client', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  it('pushHandprint sends POST to /v1/push/handprint', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 200 }),
    });

    const client = createHubClient('https://api.handprint.sh', 'test-token');
    const handprint = {
      v: 1 as const,
      ts: '2026-06-26T00:00:00Z',
      marks: [{ type: 'choice' as const, subtype: 'override' as const, note: 'test' }],
      artifacts: [],
      source: { agent: 'test' },
      parent: null,
      sig: 'abc',
      pubkey: 'def',
    };

    const result = await client.pushHandprint(handprint);
    expect(result.ok).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.handprint.sh/v1/push/handprint',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
      }),
    );
  });

  it('registerKey sends POST to /v1/keys', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 200 }),
    });

    const client = createHubClient('https://api.handprint.sh', 'test-token');
    const result = await client.registerKey({ pubkey: 'abc', label: 'MacBook' });
    expect(result.ok).toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.handprint.sh/v1/keys',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ pubkey: 'abc', label: 'MacBook' }),
      }),
    );
  });

  it('pushHandprint throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: async () => ({ message: 'bad request' }),
    });

    const client = createHubClient('https://api.handprint.sh', 'test-token');
    await expect(
      client.pushHandprint({
        v: 1 as const,
        ts: '',
        marks: [{ type: 'choice' as const, subtype: 'override' as const, note: 'x' }],
        artifacts: [],
        source: { agent: 'test' },
        parent: null,
        sig: 'a',
        pubkey: 'b',
      }),
    ).rejects.toThrow();
  });

  it('deviceCodeStart sends POST to /v1/auth/device', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        deviceCode: 'dev123',
        userCode: 'ABCD-EFGH',
        verificationUrl: 'https://handprint.sh/device',
        expiresIn: 900,
        interval: 5,
      }),
    });

    const client = createHubClient('https://api.handprint.sh');
    const result = await client.deviceCodeStart();
    expect(result.deviceCode).toBe('dev123');
    expect(result.userCode).toBe('ABCD-EFGH');
  });
});
