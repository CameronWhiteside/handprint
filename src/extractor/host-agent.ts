// src/extractor/host-agent.ts
import { execFile, execFileSync } from 'node:child_process';
import type { ExtractorProvider, RawExtraction } from './types.js';
import { parseExtractionJson } from './types.js';
import { buildUserPrompt } from './prompt.js';

/** Map a CLI id to its user-facing brand name. */
export function agentBrand(id: string): string {
  if (id === 'claude') return 'Claude Code';
  if (id === 'opencode') return 'opencode';
  if (id === 'codex') return 'Codex';
  return id;
}

export interface AgentCliSpec {
  id: 'claude' | 'opencode' | 'codex';
  bin: string;
  buildArgs(system: string, prompt: string): string[];
}

type Runner = (bin: string, args: string[]) => Promise<string>;

/**
 * Seam for detecting whether the claude CLI supports the --append-system-prompt
 * flag. Injectable via HostProviderOpts so tests can stub it without spawning
 * the real CLI.
 */
type FlagDetector = () => boolean;

/**
 * Probes `claude --help` for the --append-system-prompt flag.
 * Returns false on any error (missing binary, old version, etc.).
 */
function claudeSupportsSystemFlag(): boolean {
  try {
    const help = execFileSync('claude', ['--help'], { encoding: 'utf8', timeout: 5000 });
    return help.includes('--append-system-prompt');
  } catch {
    return false;
  }
}

// Each CLI takes a single prompt and prints the model's text to stdout.
// For claude the actual arg shape is resolved at extract-time based on flag
// detection; buildArgs here is kept as the degraded fallback only.
const AGENT_CLIS: AgentCliSpec[] = [
  {
    id: 'claude',
    bin: 'claude',
    // Degraded mode: no stable system-prompt flag confirmed, concatenated form.
    // The real buildArgs for claude is chosen dynamically in extract().
    buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
  },
  {
    id: 'opencode',
    bin: 'opencode',
    // Documented degraded mode: opencode has no stable system-prompt flag.
    buildArgs: (system, prompt) => ['run', `${system}\n\n${prompt}`],
  },
  {
    id: 'codex',
    bin: 'codex',
    // Documented degraded mode: codex has no stable system-prompt flag.
    buildArgs: (system, prompt) => ['exec', `${system}\n\n${prompt}`],
  },
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
    const child = execFile(bin, args, { maxBuffer: 16 * 1024 * 1024, timeout: 120_000 }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
    // The prompt is passed as a `-p` arg, but `claude` still blocks ~3s waiting
    // on stdin. Close it so the child sees EOF and proceeds immediately.
    child.stdin?.end();
  });

// Extraction is a structured classification task, not open-ended generation,
// so the host default is the cheapest capable Claude model. Override per machine
// with `handprint config set extraction.model <model>` (e.g. sonnet for higher
// fidelity). The 'haiku' alias resolves to the current Haiku in the user's CLI.
const DEFAULT_CLAUDE_HOST_MODEL = 'haiku';

export interface HostProviderOpts {
  cli?: 'claude' | 'opencode' | 'codex';
  run?: Runner;
  detect?: () => AgentCliSpec | undefined;
  /** Injectable seam for claude flag detection, defaults to claudeSupportsSystemFlag(). */
  claudeFlagDetector?: FlagDetector;
  /**
   * Model to pass to the claude CLI via --model. Only claude supports this for
   * now; opencode and codex do not accept a --model flag and ignore this option.
   */
  model?: string;
}

/** Build claude CLI args, separating system prompt at the correct authority level. */
function buildClaudeArgs(supportsFlag: boolean, system: string, prompt: string, model: string | undefined): string[] {
  // Prepend --model when the caller selected a specific model.
  const modelArgs: string[] = model ? ['--model', model] : [];
  if (supportsFlag) {
    // Item 1 fix: deliver SECURITY system rules at the dedicated flag authority,
    // not concatenated into the user message.
    return [...modelArgs, '-p', prompt, '--append-system-prompt', system];
  }
  // Degraded fallback: flag unsupported (old claude version or missing binary).
  return [...modelArgs, '-p', `${system}\n\n${prompt}`];
}

/** Strip a single surrounding markdown code fence (```json ... ```), if present. */
function stripCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenced?.[1] ?? text;
}

export function createHostProvider(opts: HostProviderOpts = {}): ExtractorProvider {
  const detect = opts.detect ?? detectAgentCli;
  const run = opts.run ?? defaultRunner;
  const resolveSpec = (): AgentCliSpec | undefined => {
    if (opts.cli) return AGENT_CLIS.find((c) => c.id === opts.cli);
    return detect();
  };
  // claude is the only host CLI that takes --model today, so the sensible
  // default applies only there; opencode/codex keep their own defaults.
  const claudeModel = (): string => opts.model ?? DEFAULT_CLAUDE_HOST_MODEL;

  return {
    id: 'host-agent',
    label: () => {
      const s = resolveSpec();
      const model = s?.id === 'claude' ? claudeModel() : undefined;
      return `host:${s?.id ?? 'none'}${model ? `:${model}` : ''}`;
    },
    async preflight() {
      if (resolveSpec()) return { ok: true };
      return {
        ok: false,
        reason:
          'No agent CLI found on PATH (looked for claude, opencode, codex).\n' +
          '  install one of those, or use the local model:  handprint grab --extractor local',
      };
    },
    async isAvailable(): Promise<boolean> {
      return resolveSpec() !== undefined;
    },
    async extract(window: string, system: string): Promise<RawExtraction[]> {
      const s = resolveSpec();
      if (!s) throw new Error('no agent CLI found on PATH (claude / opencode / codex)');
      const debug = Boolean(process.env.HANDPRINT_DEBUG);

      const runWith = (userPrompt: string): Promise<string> => {
        const args =
          s.id === 'claude'
            ? buildClaudeArgs((opts.claudeFlagDetector ?? claudeSupportsSystemFlag)(), system, userPrompt, claudeModel())
            : s.buildArgs(system, userPrompt);
        return run(s.bin, args);
      };

      const basePrompt = buildUserPrompt(window);
      let stdout = await runWith(basePrompt);
      if (debug) console.error(`[handprint] ${s.id} output (${stdout.length} chars):\n${stdout.slice(0, 4000)}\n`);
      let result = parseExtractionJson(stripCodeFence(stdout));

      // Host models routinely wrap JSON in a ```json fence or prose; stripCodeFence
      // plus the tolerant scanner handle that. Only when there is no JSON array at
      // all do we retry once asking for a bare array. An empty [] is a real "no
      // decisions" answer and is not retried.
      if (result.length === 0 && !/\[[\s\S]*\]/.test(stdout)) {
        const retryPrompt = `${basePrompt}\n\nRespond with ONLY a raw JSON array. No markdown code fences, no prose. If there are no decisions, respond with exactly [].`;
        stdout = await runWith(retryPrompt);
        if (debug) console.error(`[handprint] ${s.id} retry output (${stdout.length} chars):\n${stdout.slice(0, 4000)}\n`);
        result = parseExtractionJson(stripCodeFence(stdout));
      }

      // Fail loud on a genuine parse failure (no JSON array at all, even after the
      // retry). Returning [] would look like "no decisions" and silently waste a
      // long run; throwing lets grab stop early.
      if (result.length === 0 && !/\[[\s\S]*\]/.test(stdout)) {
        throw new Error(
          `${s.id} did not return a JSON array` + (debug ? '' : ' (run with HANDPRINT_DEBUG=1 to see the raw output)'),
        );
      }
      return result;
    },
  };
}
