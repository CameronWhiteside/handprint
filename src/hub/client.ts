import type { PushHandprintInput, RegisterKeyInput } from '@handprint/types';

interface BatchPushResult {
  accepted: number;
  duplicates: number;
  errors: Array<{ index: number; message: string }>;
}

export interface HubClient {
  pushHandprint(handprint: PushHandprintInput): Promise<{ ok: boolean }>;
  pushHandprints(batch: PushHandprintInput[]): Promise<BatchPushResult>;
  purge(): Promise<{ purged: number }>;
  registerKey(input: RegisterKeyInput): Promise<{ ok: boolean }>;
  deviceCodeStart(): Promise<{
    deviceCode: string;
    userCode: string;
    verificationUrl: string;
    expiresIn: number;
    interval: number;
  }>;
  deviceCodePoll(deviceCode: string): Promise<{ accessToken: string } | null>;
}

export function createHubClient(hubUrl: string, token?: string): HubClient {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const MAX_RETRIES = 5;
  const MAX_BACKOFF_MS = 16000;
  const isRecord = (v: unknown): v is Record<string, unknown> =>
    typeof v === 'object' && v !== null;

  async function request(
    path: string,
    method: string,
    body?: unknown,
    opts: { retries?: number } = {},
  ): Promise<Record<string, unknown>> {
    const retries = opts.retries ?? 0;
    for (let attempt = 0; ; attempt++) {
      const resp = await fetch(`${hubUrl}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      if (resp.ok) {
        const data: unknown = await resp.json();
        return isRecord(data) ? data : {};
      }

      // Retry on rate-limit / transient server errors, honoring Retry-After.
      if ((resp.status === 429 || resp.status >= 500) && attempt < retries) {
        const retryAfter = Number(resp.headers.get('retry-after'));
        const backoff =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? retryAfter * 1000
            : Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) + Math.floor(Math.random() * 500);
        await sleep(backoff);
        continue;
      }

      const errBody: unknown = await resp.json().catch(() => ({}));
      const message =
        isRecord(errBody) && typeof errBody.message === 'string' ? errBody.message : 'unknown error';
      throw new Error(`Hub API ${resp.status}: ${message}`);
    }
  }

  return {
    async pushHandprint(handprint: PushHandprintInput) {
      await request('/api/v1/push/handprint', 'POST', handprint);
      return { ok: true };
    },

    async pushHandprints(batch: PushHandprintInput[]): Promise<BatchPushResult> {
      const data = await request(
        '/api/v1/push/handprints',
        'POST',
        { handprints: batch },
        { retries: MAX_RETRIES },
      );
      const errors = Array.isArray(data.errors)
        ? data.errors.filter(
            (e: unknown): e is { index: number; message: string } =>
              isRecord(e) && typeof e.index === 'number' && typeof e.message === 'string',
          )
        : [];
      return {
        accepted: Number(data.accepted ?? 0),
        duplicates: Number(data.duplicates ?? 0),
        errors,
      };
    },

    async purge(): Promise<{ purged: number }> {
      const data = await request('/api/v1/purge', 'POST', { confirm: 'purge' });
      return { purged: Number(data.purged ?? 0) };
    },

    async registerKey(input: RegisterKeyInput) {
      await request('/api/v1/keys', 'POST', input);
      return { ok: true };
    },

    async deviceCodeStart() {
      const d = await request('/api/auth/device', 'POST', {});
      return {
        deviceCode: String(d.deviceCode ?? ''),
        userCode: String(d.userCode ?? ''),
        verificationUrl: String(d.verificationUrl ?? ''),
        expiresIn: Number(d.expiresIn ?? 0),
        interval: Number(d.interval ?? 0),
      };
    },

    async deviceCodePoll(deviceCode: string) {
      try {
        const data = await request('/api/auth/device/token', 'POST', { device_code: deviceCode });
        if (typeof data.accessToken === 'string') return { accessToken: data.accessToken };
        return null;
      } catch {
        return null;
      }
    },
  };
}
