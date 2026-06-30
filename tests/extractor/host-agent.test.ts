// tests/extractor/host-agent.test.ts
import { describe, it, expect } from 'vitest';
import { createHostProvider, agentBrand } from '../../src/extractor/host-agent.js';
import type { AgentCliSpec } from '../../src/extractor/host-agent.js';

describe('agentBrand', () => {
  it('maps claude to Claude Code', () => {
    expect(agentBrand('claude')).toBe('Claude Code');
  });

  it('maps opencode to opencode', () => {
    expect(agentBrand('opencode')).toBe('opencode');
  });

  it('maps codex to Codex', () => {
    expect(agentBrand('codex')).toBe('Codex');
  });

  it('passes through unknown ids unchanged', () => {
    expect(agentBrand('unknown-tool')).toBe('unknown-tool');
  });
});

describe('host-agent provider', () => {
  it('labels itself host:<cli>:<model> and is available when a cli is detected', async () => {
    const p = createHostProvider({ detect: () => ({ id: 'claude', bin: 'claude', buildArgs: () => [] }) });
    // claude gets the sensible default model in the label for provenance + display.
    expect(p.label()).toBe('host:claude:haiku');
    expect(await p.isAvailable()).toBe(true);
  });

  it('defaults the claude model to haiku when none is configured', async () => {
    let capturedArgs: string[] = [];
    const fakeRunner = async (_bin: string, args: string[]) => {
      capturedArgs = args;
      return '[]';
    };
    const p = createHostProvider({
      detect: () => ({ id: 'claude', bin: 'claude', buildArgs: (s, pr) => ['-p', `${s}\n\n${pr}`] }),
      claudeFlagDetector: () => true,
      run: fakeRunner,
    });
    await p.extract('window', 'system');
    const modelIdx = capturedArgs.indexOf('--model');
    expect(modelIdx).toBeGreaterThan(-1);
    expect(capturedArgs[modelIdx + 1]).toBe('haiku');
  });

  it('does not pass --model for non-claude clis', async () => {
    let capturedArgs: string[] = [];
    const p = createHostProvider({
      detect: () => ({ id: 'opencode', bin: 'opencode', buildArgs: (s, pr) => ['run', `${s}\n\n${pr}`] }),
      run: async (_b, a) => { capturedArgs = a; return '[]'; },
    });
    await p.extract('window', 'system');
    expect(capturedArgs).not.toContain('--model');
  });

  it('is unavailable when nothing is detected', async () => {
    const p = createHostProvider({ detect: () => undefined });
    expect(await p.isAvailable()).toBe(false);
  });

  it('uses --append-system-prompt when claude flag detector returns true', async () => {
    let capturedArgs: string[] = [];
    const fakeRunner = async (_bin: string, args: string[]) => {
      capturedArgs = args;
      return '[{"marks":[{"type":"choice","subtype":"approval","note":"used flag"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    };
    const claudeSpec: AgentCliSpec = {
      id: 'claude',
      bin: 'claude',
      buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
    };
    const p = createHostProvider({
      detect: () => claudeSpec,
      claudeFlagDetector: () => true, // stub: flag is supported
      run: fakeRunner,
    });
    const out = await p.extract('window content', 'SECURITY: follow rules');
    expect(out).toHaveLength(1);
    // System prompt must be delivered via --append-system-prompt, not mixed into the user arg.
    const flagIdx = capturedArgs.indexOf('--append-system-prompt');
    expect(flagIdx).toBeGreaterThan(-1);
    expect(capturedArgs[flagIdx + 1]).toBe('SECURITY: follow rules');
    // User prompt arg ('-p' value) must NOT contain the system prompt.
    const pIdx = capturedArgs.indexOf('-p');
    expect(pIdx).toBeGreaterThan(-1);
    expect(capturedArgs[pIdx + 1]).not.toContain('SECURITY: follow rules');
  });

  it('falls back to concatenated args when claude flag detector returns false', async () => {
    let capturedArgs: string[] = [];
    const fakeRunner = async (_bin: string, args: string[]) => {
      capturedArgs = args;
      return '[]';
    };
    const claudeSpec: AgentCliSpec = {
      id: 'claude',
      bin: 'claude',
      buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
    };
    const p = createHostProvider({
      detect: () => claudeSpec,
      claudeFlagDetector: () => false, // stub: flag not supported
      run: fakeRunner,
    });
    await p.extract('window', 'system');
    expect(capturedArgs).not.toContain('--append-system-prompt');
    const pIdx = capturedArgs.indexOf('-p');
    expect(pIdx).toBeGreaterThan(-1);
    expect(capturedArgs[pIdx + 1]).toContain('system');
  });

  it('passes --model <model> to the claude CLI when a model is configured', async () => {
    let capturedArgs: string[] = [];
    const fakeRunner = async (_bin: string, args: string[]) => {
      capturedArgs = args;
      return '[{"marks":[{"type":"choice","subtype":"approval","note":"used model flag"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    };
    const claudeSpec: AgentCliSpec = {
      id: 'claude',
      bin: 'claude',
      buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
    };
    const p = createHostProvider({
      detect: () => claudeSpec,
      claudeFlagDetector: () => true,
      run: fakeRunner,
      model: 'claude-opus-4-5',
    });
    await p.extract('window content', 'SECURITY: follow rules');
    const modelIdx = capturedArgs.indexOf('--model');
    expect(modelIdx).toBeGreaterThan(-1);
    expect(capturedArgs[modelIdx + 1]).toBe('claude-opus-4-5');
  });

  it('extracts by running the injected runner and parsing JSON from stdout', async () => {
    let capturedBin = '';
    let capturedArgs: string[] = [];
    const fakeRunner = async (bin: string, args: string[]) => {
      capturedBin = bin;
      capturedArgs = args;
      // Must start directly with '[', requireLeadingArray: true rejects markdown fences.
      return '[{"marks":[{"type":"method","subtype":"tool","note":"chose drizzle"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    };
    const p = createHostProvider({
      detect: () => ({ id: 'opencode', bin: 'opencode', buildArgs: (system, prompt) => ['run', `${system}\n\n${prompt}`] }),
      run: fakeRunner,
    });
    const out = await p.extract('window text', 'system text');
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose drizzle');
    expect(capturedBin).toBe('opencode');
    expect(capturedArgs.some((a) => a.includes('system text'))).toBe(true);
    expect(capturedArgs.some((a) => a.includes('window text'))).toBe(true);
  });
});
