import type { PushHandprintInput, RegisterKeyInput } from '@handprint/types';

export interface HubClient {
  pushHandprint(handprint: PushHandprintInput): Promise<{ ok: boolean }>;
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

  async function request(path: string, method: string, body?: unknown): Promise<any> {
    const resp = await fetch(`${hubUrl}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await resp.json();
    if (!resp.ok) {
      throw new Error(`Hub API ${resp.status}: ${(data as any).message ?? 'unknown error'}`);
    }
    return data;
  }

  return {
    async pushHandprint(handprint: PushHandprintInput) {
      await request('/v1/push/handprint', 'POST', handprint);
      return { ok: true };
    },

    async registerKey(input: RegisterKeyInput) {
      await request('/v1/keys', 'POST', input);
      return { ok: true };
    },

    async deviceCodeStart() {
      return request('/v1/auth/device', 'POST', {});
    },

    async deviceCodePoll(deviceCode: string) {
      try {
        const data = await request('/v1/auth/token', 'POST', { device_code: deviceCode });
        if (data.accessToken) return { accessToken: data.accessToken };
        return null;
      } catch {
        return null;
      }
    },
  };
}
