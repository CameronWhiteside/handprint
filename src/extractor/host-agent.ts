// src/extractor/host-agent.ts
import { execFile, execFileSync } from 'node:child_process';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { buildUserPrompt } from './prompt.js';

export interface AgentCliSpec {
  id: 'claude' | 'opencode' | 'codex';
  bin: string;
  buildArgs(system: string, prompt: string): string[];
}

export type Runner = (bin: string, args: string[], input: string) => Promise<string>;

// Each CLI takes a single prompt and prints the model's text to stdout.
export const AGENT_CLIS: AgentCliSpec[] = [
  { id: 'claude', bin: 'claude', buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`] },
  { id: 'opencode', bin: 'opencode', buildArgs: (system, prompt) => ['run', `${system}\n\n${prompt}`] },
  { id: 'codex', bin: 'codex', buildArgs: (system, prompt) => ['exec', `${system}\n\n${prompt}`] },
];

function onPath(bin: string): boolean {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    execFileSync(probe, [bin], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

export function detectAgentCli(): AgentCliSpec | undefined {
  return AGENT_CLIS.find((c) => onPath(c.bin));
}

const defaultRunner: Runner = (bin, args) =>
  new Promise((resolve, reject) => {
    execFile(bin, args, { maxBuffer: 16 * 1024 * 1024, timeout: 120_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });

export interface HostProviderOpts {
  cli?: 'claude' | 'opencode' | 'codex';
  run?: Runner;
  detect?: () => AgentCliSpec | undefined;
}

export function createHostProvider(opts: HostProviderOpts = {}): ExtractorProvider {
  const detect = opts.detect ?? detectAgentCli;
  const run = opts.run ?? defaultRunner;
  const resolveSpec = (): AgentCliSpec | undefined => {
    if (opts.cli) return AGENT_CLIS.find((c) => c.id === opts.cli);
    return detect();
  };

  return {
    id: 'host-agent',
    label: () => `host:${resolveSpec()?.id ?? 'none'}`,
    async isAvailable(): Promise<boolean> {
      return resolveSpec() !== undefined;
    },
    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const s = resolveSpec();
      if (!s) throw new Error('no agent CLI found on PATH (claude / opencode / codex)');
      const prompt = buildUserPrompt(window);
      const stdout = await run(s.bin, s.buildArgs(system, prompt), prompt);
      return parseExtractionJson(stdout);
    },
  };
}
