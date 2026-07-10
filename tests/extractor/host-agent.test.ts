// tests/extractor/host-agent.test.ts
import { describe, it, expect } from 'vitest';
import { createHostProvider, agentBrand, isSafeCmdToken } from '../../src/extractor/host-agent.js';
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
    const p = createHostProvider({ detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: () => [] }) });
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
      detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: (s, pr) => ['-p', `${s}\n\n${pr}`] }),
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
      detect: () => ({ id: 'opencode', bin: 'opencode', supported: true, buildArgs: (s, pr) => ['run', `${s}\n\n${pr}`] }),
      run: async (_b, a) => { capturedArgs = a; return '[]'; },
    });
    await p.extract('window', 'system');
    expect(capturedArgs).not.toContain('--model');
  });

  it('is unavailable when nothing is detected', async () => {
    const p = createHostProvider({ detect: () => undefined });
    expect(await p.isAvailable()).toBe(false);
  });

  it('POSIX: system via --append-system-prompt (argv), prompt via stdin, never in argv', async () => {
    let capturedArgs: string[] = [];
    let capturedStdin: string | undefined;
    const fakeRunner = async (_bin: string, args: string[], stdin?: string) => {
      capturedArgs = args;
      capturedStdin = stdin;
      return '[{"marks":[{"type":"choice","subtype":"approval","note":"used flag"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
    };
    const claudeSpec: AgentCliSpec = {
      id: 'claude',
      bin: 'claude',
      supported: true,
      buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
    };
    const p = createHostProvider({
      detect: () => claudeSpec,
      claudeFlagDetector: () => true, // stub: flag is supported
      platform: 'linux', // POSIX path (not the Windows fold)
      run: fakeRunner,
    });
    const out = await p.extract('window content', 'SECURITY: follow rules');
    expect(out).toHaveLength(1);
    // System prompt at flag authority, in argv.
    const flagIdx = capturedArgs.indexOf('--append-system-prompt');
    expect(flagIdx).toBeGreaterThan(-1);
    expect(capturedArgs[flagIdx + 1]).toBe('SECURITY: follow rules');
    // The untrusted transcript is delivered on stdin, never argv.
    expect(capturedStdin).toContain('window content');
    expect(capturedStdin).not.toContain('SECURITY: follow rules');
    expect(capturedArgs.join(' ')).not.toContain('window content');
  });

  it('POSIX no-flag: folds system + prompt into stdin, argv stays flag-only', async () => {
    let capturedArgs: string[] = [];
    let capturedStdin: string | undefined;
    const fakeRunner = async (_bin: string, args: string[], stdin?: string) => {
      capturedArgs = args;
      capturedStdin = stdin;
      return '[]';
    };
    const claudeSpec: AgentCliSpec = {
      id: 'claude',
      bin: 'claude',
      supported: true,
      buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
    };
    const p = createHostProvider({
      detect: () => claudeSpec,
      claudeFlagDetector: () => false, // stub: flag not supported
      platform: 'linux',
      run: fakeRunner,
    });
    await p.extract('window', 'system');
    expect(capturedArgs).not.toContain('--append-system-prompt');
    expect(capturedStdin).toContain('system');
  });

  it('Windows: folds everything into stdin even when the flag is supported', async () => {
    let capturedArgs: string[] = [];
    let capturedStdin: string | undefined;
    const fakeRunner = async (_bin: string, args: string[], stdin?: string) => {
      capturedArgs = args;
      capturedStdin = stdin;
      return '[]';
    };
    const claudeSpec: AgentCliSpec = {
      id: 'claude',
      bin: 'claude',
      supported: true,
      buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
    };
    const p = createHostProvider({
      detect: () => claudeSpec,
      claudeFlagDetector: () => true,
      platform: 'win32', // system prompt can't cross cmd.exe → fold into stdin
      run: fakeRunner,
    });
    await p.extract('win window', 'SECURITY rules');
    // argv must be flag-only (safe tokens) so it survives cmd.exe.
    expect(capturedArgs).not.toContain('--append-system-prompt');
    for (const a of capturedArgs) expect(isSafeCmdToken(a)).toBe(true);
    // Everything untrusted/metachar rode stdin.
    expect(capturedStdin).toContain('SECURITY rules');
    expect(capturedStdin).toContain('win window');
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
      supported: true,
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
      detect: () => ({ id: 'opencode', bin: 'opencode', supported: true, buildArgs: (system, prompt) => ['run', `${system}\n\n${prompt}`] }),
      run: fakeRunner,
    });
    const out = await p.extract('window text', 'system text');
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toBe('chose drizzle');
    expect(capturedBin).toBe('opencode');
    expect(capturedArgs.some((a) => a.includes('system text'))).toBe(true);
    expect(capturedArgs.some((a) => a.includes('window text'))).toBe(true);
  });

  it('parses JSON wrapped in a markdown code fence (host models do this)', async () => {
    const fenced =
      '```json\n[{"marks":[{"type":"vision","subtype":"principle","note":"reliability is non-negotiable"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]\n```';
    const p = createHostProvider({
      detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: (s, pr) => ['-p', `${s}\n\n${pr}`] }),
      claudeFlagDetector: () => true,
      run: async () => fenced,
    });
    const out = await p.extract('window', 'system');
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toContain('reliability');
  });

  it('retries once for a bare array when the first output contains no JSON', async () => {
    let call = 0;
    const p = createHostProvider({
      detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: (_s, pr) => ['-p', pr] }),
      claudeFlagDetector: () => true,
      run: async () => {
        call += 1;
        return call === 1
          ? 'Sorry, I could not find any decisions here.'
          : '[{"marks":[{"type":"method","subtype":"tool","note":"chose drizzle"}],"artifacts":[],"timestamp":"2026-06-01T10:00:00Z"}]';
      },
    });
    const out = await p.extract('w', 's');
    expect(call).toBe(2);
    expect(out).toHaveLength(1);
    expect(out[0].marks[0].note).toContain('drizzle');
  });

  it('does not retry when the model returns an empty array (genuine no decisions)', async () => {
    let call = 0;
    const p = createHostProvider({
      detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: (_s, pr) => ['-p', pr] }),
      claudeFlagDetector: () => true,
      run: async () => {
        call += 1;
        return '[]';
      },
    });
    const out = await p.extract('w', 's');
    expect(call).toBe(1);
    expect(out).toHaveLength(0);
  });

  it('throws (not silent empty) when the model returns no JSON array even after retry', async () => {
    const p = createHostProvider({
      detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: (_s, pr) => ['-p', pr] }),
      claudeFlagDetector: () => true,
      run: async () => 'I am sorry, there is nothing here I can turn into JSON.',
    });
    await expect(p.extract('w', 's')).rejects.toThrow(/did not return a JSON array/);
  });

  it('preflight is ok for a detected, supported claude', async () => {
    const p = createHostProvider({
      detect: () => ({ id: 'claude', bin: 'claude', supported: true, buildArgs: () => [] }),
    });
    expect(await p.preflight!()).toEqual({ ok: true });
  });

  it('preflight says "coming soon" (not "not found") when only an unsupported agent is detected', async () => {
    const p = createHostProvider({
      detect: () => ({ id: 'opencode', bin: 'opencode', supported: false, buildArgs: () => [] }),
    });
    const pf = await p.preflight!();
    expect(pf.ok).toBe(false);
    expect(pf.reason).toMatch(/coming soon/i);
    expect(pf.reason).toContain('opencode');
    expect(await p.isAvailable()).toBe(false);
  });

  it('extract refuses an unsupported agent with the "coming soon" message', async () => {
    const p = createHostProvider({
      detect: () => ({ id: 'codex', bin: 'codex', supported: false, buildArgs: () => [] }),
      run: async () => '[]',
    });
    await expect(p.extract('w', 's')).rejects.toThrow(/coming soon/i);
  });
});
