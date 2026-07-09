// src/extractor/host-agent.ts
import { spawn, execFileSync } from 'node:child_process';
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

/**
 * Runs a resolved agent CLI. The untrusted prompt is delivered via `stdinPayload`
 * (never argv), so it can be any size and can never be interpreted by a shell.
 */
type Runner = (bin: string, args: string[], stdinPayload?: string) => Promise<string>;

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

// opencode/codex take the prompt as a positional argv arg (they aren't verified
// to read stdin). claude's real invocation is resolved in extract() — it always
// delivers the prompt via stdin. These entries are the degraded fallback only.
const AGENT_CLIS: AgentCliSpec[] = [
  {
    id: 'claude',
    bin: 'claude',
    buildArgs: (system, prompt) => ['-p', `${system}\n\n${prompt}`],
  },
  {
    id: 'opencode',
    bin: 'opencode',
    buildArgs: (system, prompt) => ['run', `${system}\n\n${prompt}`],
  },
  {
    id: 'codex',
    bin: 'codex',
    buildArgs: (system, prompt) => ['exec', `${system}\n\n${prompt}`],
  },
];

/**
 * Resolve a command to its absolute path via `where` (Windows) / `which` (POSIX).
 * On Windows this returns the real `claude.cmd`/`.exe`, which Node's spawn cannot
 * find by bare name (it doesn't consult PATHEXT). Returns undefined if not found.
 */
function resolveBin(bin: string): string | undefined {
  const probe = process.platform === 'win32' ? 'where' : 'which';
  try {
    const out = execFileSync(probe, [bin], { encoding: 'utf8', timeout: 5000 });
    const first = out.split(/\r?\n/).find((line) => line.trim() !== '');
    return first?.trim();
  } catch {
    return undefined;
  }
}

export function detectAgentCli(): AgentCliSpec | undefined {
  return AGENT_CLIS.find((c) => resolveBin(c.bin) !== undefined);
}

// On the Windows cmd.exe path, argv is joined into one command line, so every
// arg must be a bare token — no spaces or shell metacharacters. Untrusted content
// (the transcript) must arrive via stdin, never here. Trusted flags/model ids
// (e.g. `--model`, `claude-haiku-4-5-20251001`) match this; a prompt does not.
export function isSafeCmdToken(arg: string): boolean {
  return /^[\w.@:/\\-]+$/.test(arg);
}

const TIMEOUT_MS = 120_000;
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024;

const defaultRunner: Runner = (bin, args, stdinPayload) =>
  new Promise<string>((resolve, reject) => {
    const resolved = resolveBin(bin) ?? bin;
    const isWinShim = process.platform === 'win32' && /\.(cmd|bat)$/i.test(resolved);

    if (isWinShim) {
      const unsafe = args.find((a) => !isSafeCmdToken(a));
      if (unsafe !== undefined) {
        reject(
          new Error(
            `${bin} on Windows is a .cmd shim and cannot safely receive the argument "${unsafe.slice(0, 30)}…" ` +
              `via cmd.exe. Use --extractor local, or an agent that ships a native .exe.`,
          ),
        );
        return;
      }
    }

    // .cmd/.bat shims must run through cmd.exe; native binaries spawn directly.
    const child = isWinShim
      ? spawn('cmd.exe', ['/d', '/s', '/c', `"${resolved}" ${args.join(' ')}`], {
          windowsVerbatimArguments: true,
        })
      : spawn(resolved, args);

    const chunks: Buffer[] = [];
    let bytes = 0;
    let settled = false;
    const finish = (run: () => void): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      run();
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(() => reject(new Error(`${bin} timed out after ${TIMEOUT_MS / 1000}s`)));
    }, TIMEOUT_MS);

    child.stdout?.on('data', (d: Buffer) => {
      bytes += d.length;
      if (bytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(() => reject(new Error(`${bin} output exceeded ${MAX_OUTPUT_BYTES} bytes`)));
        return;
      }
      chunks.push(d);
    });
    child.on('error', (err) => finish(() => reject(err)));
    child.on('close', () => finish(() => resolve(Buffer.concat(chunks).toString('utf8'))));

    // The prompt is delivered here, not in argv. Closing stdin gives the child EOF
    // so it never blocks waiting for more input.
    if (stdinPayload !== undefined) child.stdin?.write(stdinPayload);
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
  /** Injectable platform for tests (defaults to process.platform). */
  platform?: NodeJS.Platform;
}

/**
 * Build the claude invocation: trusted flags in argv, the (untrusted, unbounded)
 * prompt in stdin.
 * - POSIX with the flag: system rides `--append-system-prompt` at flag authority.
 * - Windows (foldSystem): the system prompt contains cmd metacharacters (< > |),
 *   which can't cross cmd.exe even as a "trusted" arg, so it is folded into the
 *   stdin payload and argv stays flag-only.
 */
export function buildClaudeInvocation(input: {
  supportsFlag: boolean;
  foldSystem: boolean;
  system: string;
  prompt: string;
  model: string | undefined;
}): { args: string[]; stdin: string } {
  const modelArgs = input.model ? ['--model', input.model] : [];
  if (input.supportsFlag && !input.foldSystem) {
    return { args: [...modelArgs, '--append-system-prompt', input.system, '-p'], stdin: input.prompt };
  }
  return { args: [...modelArgs, '-p'], stdin: `${input.system}\n\n${input.prompt}` };
}

/** Strip a single surrounding markdown code fence (```json ... ```), if present. */
function stripCodeFence(text: string): string {
  const fenced = text.trim().match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/);
  return fenced?.[1] ?? text;
}

export function createHostProvider(opts: HostProviderOpts = {}): ExtractorProvider {
  const detect = opts.detect ?? detectAgentCli;
  const run = opts.run ?? defaultRunner;
  const platform = opts.platform ?? process.platform;
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

      // On Windows the system prompt can't cross cmd.exe as an arg, so fold it
      // into the stdin payload; skip the flag probe entirely there.
      const foldSystem = platform === 'win32';

      const runWith = (userPrompt: string): Promise<string> => {
        if (s.id === 'claude') {
          const supportsFlag = foldSystem
            ? false
            : (opts.claudeFlagDetector ?? claudeSupportsSystemFlag)();
          const inv = buildClaudeInvocation({
            supportsFlag,
            foldSystem,
            system,
            prompt: userPrompt,
            model: claudeModel(),
          });
          return run(s.bin, inv.args, inv.stdin);
        }
        // opencode/codex: positional prompt (POSIX-safe via direct spawn). On a
        // Windows .cmd shim the runner's token guard turns this into a clear error.
        return run(s.bin, s.buildArgs(system, userPrompt));
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
