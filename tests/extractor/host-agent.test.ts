// tests/extractor/host-agent.test.ts
import { describe, it, expect } from 'vitest';
import { createHostProvider } from '../../src/extractor/host-agent.js';

describe('host-agent provider', () => {
  it('labels itself host:<cli> and is available when a cli is detected', async () => {
    const p = createHostProvider({ detect: () => ({ id: 'claude', bin: 'claude', buildArgs: () => [] }) });
    expect(p.label()).toBe('host:claude');
    expect(await p.isAvailable()).toBe(true);
  });

  it('is unavailable when nothing is detected', async () => {
    const p = createHostProvider({ detect: () => undefined });
    expect(await p.isAvailable()).toBe(false);
  });

  it('extracts by running the injected runner and parsing JSON from stdout', async () => {
    const fakeRunner = async () =>
      '```json\n[{"marks":[{"type":"method","subtype":"tool","note":"chose drizzle"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]\n```';
    const p = createHostProvider({
      detect: () => ({ id: 'opencode', bin: 'opencode', buildArgs: () => ['run'] }),
      run: fakeRunner,
    });
    const out = await p.extract('window text', 'system text');
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose drizzle');
  });
});
