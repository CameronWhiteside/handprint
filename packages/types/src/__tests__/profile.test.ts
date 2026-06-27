import { describe, it, expect } from 'vitest';
import { projectConfigSchema, globalConfigSchema } from '../profile.js';

// ── projectConfigSchema ─────────────────────────────────────────

describe('projectConfigSchema', () => {
  it('accepts a valid project config', () => {
    const result = projectConfigSchema.safeParse({
      version: '1.0.0',
      visibility: 'private',
      createdAt: '2026-06-26T00:00:00Z',
    });
    expect(result.success).toBe(true);
  });

  it('defaults visibility to private', () => {
    const result = projectConfigSchema.safeParse({
      version: '1.0.0',
      createdAt: '2026-06-26T00:00:00Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.visibility).toBe('private');
    }
  });
});

// ── globalConfigSchema ──────────────────────────────────────────

describe('globalConfigSchema', () => {
  const validGlobal = {
    version: '1.0.0',
    createdAt: '2026-06-26T00:00:00Z',
    identity: {
      handle: 'cameronw',
      name: 'Cameron Whiteside',
      email: 'cam@example.com',
    },
    hub: {
      url: 'https://hub.handprint.sh',
    },
  };

  it('accepts a valid global config', () => {
    const result = globalConfigSchema.safeParse(validGlobal);
    expect(result.success).toBe(true);
  });

  it('rejects missing identity', () => {
    const { identity, ...noIdentity } = validGlobal;
    const result = globalConfigSchema.safeParse(noIdentity);
    expect(result.success).toBe(false);
  });
});
