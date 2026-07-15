import { Command } from 'commander';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import { init } from '../src/commands/init.js';
import { grab } from '../src/commands/grab.js';
import type { GrabPlan, GrabDecision } from '../src/commands/grab.js';
import { agentBrand } from '../src/extractor/host-agent.js';
import { downloadConsent } from '../src/extractor/local-model.js';
import { dim, amber, bold, markColor, sym } from '../src/util/ui.js';
import { push } from '../src/commands/push.js';
import { purge } from '../src/commands/purge.js';
import { verifyChain } from '../src/commands/verify.js';
import { listHandprints } from '../src/commands/log.js';
import { showHandprint } from '../src/commands/show.js';
import { status } from '../src/commands/status.js';
import { login } from '../src/commands/login.js';
import { reset, type ResetPlan } from '../src/commands/reset.js';
import { keysAdd, keysList, keysRotate, keysExport } from '../src/commands/keys.js';
import { listSources } from '../src/commands/sources.js';
import {
  getConfig,
  getConfigValue,
  setConfigValue,
  saveGlobalConfig,
  saveProjectConfig,
} from '../src/commands/config.js';
import { ensureSkillSynced, installSkill, uninstallSkill } from '../src/skill/install.js';
// Item 7: read real version from package.json so dist/bin/handprint.js always
// reports the version declared in the tarball (../../package.json from dist/bin/).
const _require = createRequire(import.meta.url);

function isVersionedPackage(v: unknown): v is { version: string } {
  if (typeof v !== 'object' || v === null || !('version' in v)) return false;
  return typeof v.version === 'string';
}

const _pkg: unknown = _require('../../package.json');
const version = isVersionedPackage(_pkg) ? _pkg.version : '0.0.0';

/** Format a token count for human display: 2_500_000 -> "2.5M", 740_000 -> "740k". */
function humanTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}k`;
  return String(n);
}

/**
 * Return a label for the extractor suitable for one-line display.
 * host: engines include the agent brand; ollama/local note they are on-machine.
 */
function extractorLabel(extractor: string): string {
  if (extractor.startsWith('host:')) {
    const [id, model] = extractor.slice('host:'.length).split(':');
    const brand = agentBrand(id);
    return model ? `${extractor} (${brand}, model: ${model})` : `${extractor} (${brand})`;
  }
  if (extractor.startsWith('ollama:') || extractor.startsWith('local:')) {
    return `${extractor} (on your machine)`;
  }
  return extractor;
}

/**
 * Suggest narrowing a big first capture. grab is incremental, so starting with a
 * small window and re-running is strictly better than one giant run.
 * ponytail: 30-chunk threshold; make configurable if anyone asks.
 */
function startSmallHint(plan: GrabPlan, narrowed: boolean): string {
  if (narrowed || plan.totalChunks <= 30) return '';
  return (
    '\n  Tip: large capture — consider starting with `--days 7` (or `--project <name>`) ' +
    'and re-running to continue; grab is incremental, so nothing is redone.'
  );
}

/** Build the estimate line appropriate for the extractor type. */
function estimateLine(plan: GrabPlan, narrowed: boolean): string {
  const hint = startSmallHint(plan, narrowed);
  if (plan.extractor.startsWith('host:')) {
    const id = plan.extractor.slice('host:'.length).split(':')[0];
    return `Estimated: ~${plan.totalChunks} model calls, ~${humanTokens(plan.estTokensIn)} input tokens, billed to your ${agentBrand(id)} quota.${hint}`;
  }
  const base = `Estimated: ~${plan.totalChunks} model calls, ~${humanTokens(plan.estTokensIn)} input tokens, runs on your machine (nothing billed).`;
  // Local CPU inference is slow; a big batch can take hours. Steer to a fast path
  // before the user commits — the per-chunk ETA only appears mid-run.
  // ponytail: 20-chunk threshold; make configurable if anyone asks.
  if (plan.extractor.startsWith('local:') && plan.totalChunks > 20) {
    return (
      base +
      '\n  Heads up: local models on CPU can take hours at this size. ' +
      '`--extractor host` (your Claude CLI) or `--extractor anthropic` is far faster.'
    );
  }
  return base;
}

// Silently keep the bundled skill in sync with the installed CLI version.
// Wrapped in try/catch so it can never block a normal command.
try {
  ensureSkillSynced();
} catch { /* ignore */ }

const program = new Command();

program
  .name('handprint')
  .description('Human decision provenance for the age of AI')
  .version(version);

program
  .command('init')
  .description('Initialize handprint (global identity + project)')
  .option('--global', 'Initialize global identity at ~/.handprint/')
  .action(async (opts) => {
    try {
      const path = await init(process.cwd(), {
        global: opts.global,
      });
      console.log(path);
      // Install the bundled /handprint skill when ~/.claude already exists.
      const claudeHome = join(homedir(), '.claude');
      if (existsSync(claudeHome)) {
        try {
          const result = installSkill({ scope: 'global' });
          console.log(`Installed the /handprint skill to ${result.path}`);
        } catch { /* non-fatal */ }
      } else {
        console.log(
          'Tip: install Claude Code, then run `handprint skill install` to enable the /handprint skill.',
        );
      }
      console.log('');
      console.log('Next:');
      console.log('  • Capture now:        handprint grab            (add --push to publish)');
      console.log('  • Capture on a timer: see docs/CAPTURE.md.');
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('login')
  .description('Authenticate with the handprint hub')
  .action(async () => {
    try {
      const result = await login();
      console.log(`logged in as ${result.handle}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('sources')
  .description('List transcript sources, where they live, and how many sessions are found')
  .action(() => {
    for (const s of listSources()) {
      const status = s.implemented ? `${s.sessions} sessions` : 'not yet supported';
      console.log(`${s.id.padEnd(12)} ${s.displayName.padEnd(14)} ${status}`);
      console.log(`  paths: ${s.locations.join(', ')}`);
      console.log(`  data:  timestamps=${s.capabilities.timestamps} project=${s.capabilities.project} branch=${s.capabilities.gitBranch} model=${s.capabilities.model}`);
    }
  });

program
  .command('grab')
  .description('Scan AI transcripts, confirm, then extract decisions')
  .argument('[path]', 'Directory to store the handprints in (default: current directory)')
  .option('-n, --limit <n>', 'Max sessions to scan', parseInt)
  .option('--source <id>', 'Only scan one source (claude-code, opencode, codex)')
  .option('--project <name...>', 'Only sessions whose project path contains this (repeatable)')
  .option('--days <n>', 'Only sessions active in the last N days', parseInt)
  .option('--since <when>', 'Only sessions active on/after this (ISO date or relative like 7d)')
  .option('--until <when>', 'Only sessions active on/before this (ISO date or relative)')
  .option('--min-messages <n>', 'Skip sessions with fewer than N messages', parseInt)
  .option('--redo', 'Re-grab sessions already in the local chain (default: skip them)')
  .option('--extractor <kind>', 'Extractor: local | host | openai | anthropic')
  .option('--base-url <url>', 'Extractor base URL (openai-compatible endpoints)')
  .option('--model <model>', 'Extractor model id')
  .option('--api-key <key>', 'Extractor API key (anthropic / openai-compatible endpoints)')
  .option('--concurrency <n>', 'Chunks extracted in parallel per session (default 1; keep 1 for local)', parseInt)
  .option('--push', 'Publish to the hub after grabbing')
  .option('-y, --yes', 'Skip the confirm step and process everything (for agents/scripts)')
  .option('--dry-run', 'Quick scan: preview scope without processing or confirming')
  .action(async (pathArg: string | undefined, opts) => {
    try {
      const onDownload = async (entry: { id: string; sizeMb: number }) => {
        const decision = downloadConsent({
          yes: Boolean(opts.yes),
          autoDownloadEnv: process.env.HANDPRINT_AUTO_DOWNLOAD,
          isTty: Boolean(process.stdin.isTTY),
        });
        if (decision === 'auto') {
          console.error(`Downloading local model ${entry.id} (${entry.sizeMb} MB)…`);
          return true;
        }
        if (decision === 'deny') return false;
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question(`Download local model ${entry.id} (${entry.sizeMb} MB)? [y/N] `);
        rl.close();
        return answer.trim().toLowerCase() === 'y';
      };

      const isTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      // Did the user already scope the run? If not, a huge plan gets a "start small" tip.
      const narrowed = Boolean(
        opts.days || opts.since || opts.until || (opts.project && opts.project.length) || opts.limit,
      );
      const confirm = isTty
        ? async (plan: GrabPlan): Promise<GrabDecision> => {
            console.log(
              amber(bold(`\n${sym.hand}  ${plan.totalSessions} session(s)`)) +
                dim(` · ${plan.totalMessages} message(s) · ~${plan.totalChunks} model call(s) across ${plan.projects.length} project(s):`),
            );
            plan.projects.forEach((pr, i) => {
              console.log(
                `  [${i + 1}] ${pr.project}  ${pr.sessions} session(s) · ${pr.messages} msgs · ${pr.chunks} chunks`,
              );
            });
            console.log(`Extractor: ${extractorLabel(plan.extractor)}`);
            console.log(estimateLine(plan, narrowed));
            const skipped: string[] = [];
            if (plan.skippedAlreadyGrabbed) skipped.push(`${plan.skippedAlreadyGrabbed} already grabbed`);
            if (plan.skippedUnchanged) skipped.push(`${plan.skippedUnchanged} with no new activity`);
            if (plan.skippedTooSmall) skipped.push(`${plan.skippedTooSmall} below --min-messages`);
            if (plan.skippedOutOfRange) skipped.push(`${plan.skippedOutOfRange} outside the time window`);
            if (skipped.length) console.log(`Skipped: ${skipped.join(', ')}.`);
            const rl = createInterface({ input: process.stdin, output: process.stdout });
            const ans = (await rl.question('\nProcess [a]ll, pick numbers (e.g. 1,3), or [n]o? ')).trim().toLowerCase();
            rl.close();
            if (['a', 'all', 'y', 'yes'].includes(ans)) return { proceed: true };
            if (['', 'n', 'no'].includes(ans)) return { proceed: false };
            const picks = ans.split(/[\s,]+/).map((x) => parseInt(x, 10)).filter((n) => !Number.isNaN(n));
            const projects = picks.map((n) => plan.projects[n - 1]?.project).filter((x): x is string => Boolean(x));
            return projects.length > 0 ? { proceed: true, projects } : { proceed: false };
          }
        : undefined;

      // 'ollama' is an alias for 'openai' (same protocol)
      const extractor: 'local' | 'host' | 'openai' | 'anthropic' | undefined =
        opts.extractor === 'ollama' ? 'openai' : opts.extractor;

      const result = await grab(pathArg ? resolve(pathArg) : process.cwd(), {
        limit: opts.limit,
        source: opts.source,
        project: opts.project,
        days: opts.days,
        since: opts.since,
        until: opts.until,
        minMessages: opts.minMessages,
        redo: opts.redo,
        extractor,
        baseUrl: opts.baseUrl,
        model: opts.model,
        apiKey: opts.apiKey,
        concurrency: opts.concurrency,
        dryRun: opts.dryRun,
        yes: opts.yes,
        onDownload,
        confirm,
      });

      const plan = result.plan;
      const secs = (result.elapsedMs / 1000).toFixed(1);

      if (plan.totalSessions === 0) {
        console.log('no sessions found. Run `handprint sources` to see what is detected.');
        return;
      }

      const printScope = () => {
        console.log(
          amber(bold(`\n${sym.hand}  ${plan.totalSessions} session(s)`)) +
            dim(` · ${plan.totalMessages} message(s) · ~${plan.totalChunks} model call(s) across ${plan.projects.length} project(s):`),
        );
        for (const pr of plan.projects) {
          console.log(`  ${pr.project}  ${pr.sessions} · ${pr.messages} msgs · ${pr.chunks} chunks`);
        }
        console.log(`Extractor: ${extractorLabel(plan.extractor)}`);
        console.log(estimateLine(plan, narrowed));
        const skips: string[] = [];
        if (plan.skippedAlreadyGrabbed) skips.push(`${plan.skippedAlreadyGrabbed} already grabbed`);
        if (plan.skippedUnchanged) skips.push(`${plan.skippedUnchanged} with no new activity`);
        if (plan.skippedTooSmall) skips.push(`${plan.skippedTooSmall} below --min-messages`);
        if (plan.skippedOutOfRange) skips.push(`${plan.skippedOutOfRange} outside the time window`);
        if (skips.length) console.log(`Skipped: ${skips.join(', ')}.`);
      };

      if (result.blockedReason) {
        printScope();
        console.log(`\nCannot run the ${plan.extractor} extractor:\n${result.blockedReason}\n`);
        return;
      }

      if (result.dryRun) {
        printScope();
        console.log(
          'next: `handprint grab` to process (you will confirm first) · `--project <name>` to target · `-y` to skip confirm.\n',
        );
        return;
      }

      if (result.needsConfirm) {
        printScope();
        console.log(
          'nothing processed (no interactive terminal to confirm). Re-run with `-y` to process all, or `--project <name>` / `-n N` to target a subset.\n',
        );
        return;
      }

      if (!result.confirmed) {
        console.log('cancelled. Nothing processed.');
        return;
      }

      if (result.handprintsCreated === 0) {
        console.log(
          dim(`\nNo decisions found (${result.sessionsProcessed} session(s), ${result.messagesProcessed} messages, ${secs}s).`),
        );
        return;
      }

      // grab already printed the "✓ N handprints …" summary; list the marks here.
      console.log('');
      for (const { hash, marks } of result.details) {
        for (const m of marks) {
          const paint = markColor(m.type);
          console.log(
            `  ${dim(hash.slice(0, 8))}  ${paint(sym.bullet)} ${paint(`${m.type}/${m.subtype}`.padEnd(16))} ${m.note}`,
          );
        }
      }

      if (opts.push && result.handprintsCreated > 0) {
        const root = pathArg ? resolve(pathArg) : process.cwd();
        const p = await push(root);
        console.log(
          `\npushed ${p.pushed} handprint(s)` +
            `${p.duplicates ? `, ${p.duplicates} already on hub` : ''}` +
            `${p.skipped ? `, ${p.skipped} skipped` : ''}`,
        );
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('push')
  .description('Publish handprints to the hub')
  .action(async () => {
    try {
      const result = await push(process.cwd());
      console.log(
        `pushed ${result.pushed} handprints` +
          `${result.duplicates ? `, ${result.duplicates} already on hub` : ''}` +
          ` (${result.skipped} skipped)`,
      );
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('purge')
  .description('Delete ALL your handprints from the hub (local chain untouched; use `reset` for that)')
  .option('--force', 'Skip the confirmation prompt')
  .action(async (opts) => {
    try {
      if (!opts.force) {
        if (!process.stdin.isTTY) {
          console.log('Refusing to purge without a terminal to confirm. Re-run with --force.');
          return;
        }
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question('This deletes ALL your handprints from the hub. Type "purge" to confirm: ');
        rl.close();
        if (answer.trim() !== 'purge') {
          console.log('cancelled.');
          return;
        }
      }
      const result = await purge();
      console.log(`purged ${result.purged} handprint(s) from the hub`);
    } catch (err) {
      console.error(err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program
  .command('log')
  .description('List local handprints')
  .option('-t, --type <type>', 'Filter by mark type')
  .option('-n, --limit <n>', 'Limit results', parseInt)
  .action((opts) => {
    const entries = listHandprints(process.cwd(), {
      type: opts.type,
      limit: opts.limit,
    });
    if (entries.length === 0) {
      console.log('no handprints yet');
      return;
    }
    for (const { hash, handprint } of entries) {
      const h = hash.slice(0, 10);
      const ts = handprint.ts.slice(0, 10);
      const types = handprint.marks.map((m) => `${m.type}/${m.subtype}`).join(', ');
      const note = handprint.marks[0]?.note.slice(0, 60) ?? '';
      console.log(`${h}  ${ts}  [${types}]  ${note}`);
    }
  });

program
  .command('show <ref>')
  .description('Show a handprint by hash or prefix')
  .option('--decrypt', 'Decrypt the payload')
  .action(async (ref: string, opts) => {
    const detail = await showHandprint(process.cwd(), ref, {
      decrypt: opts.decrypt,
    });
    if (!detail) {
      console.error('handprint not found');
      process.exit(1);
    }
    console.log(JSON.stringify(detail, null, 2));
  });

program
  .command('verify')
  .description('Verify chain integrity and signatures')
  .action(async () => {
    try {
      const result = await verifyChain(process.cwd());
      if (result.chainLength === 0) {
        console.log('chain: empty');
        console.log('status: valid');
        return;
      }
      console.log(`chain: ${result.chainLength} handprint${result.chainLength === 1 ? '' : 's'}`);
      console.log(`head: ${result.head!.slice(0, 12)}`);
      if (result.valid) {
        console.log('status: valid, all hashes verified, signatures valid, chain intact');
      } else {
        console.log('status: INVALID');
        for (const { hash, error } of result.errors) {
          console.log(`  ${hash.slice(0, 12)}, ${error}`);
        }
        process.exit(1);
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command('status')
  .description('Chain state, auth status, key fingerprint')
  .action(async () => {
    const s = await status(process.cwd());
    if (!s.globalInitialized) {
      console.log('not initialized: run "handprint init --global"');
      return;
    }
    console.log(`handle:      ${s.handle}`);
    console.log(`fingerprint: ${s.fingerprint}`);
    console.log(`chain:       ${s.chainLength} handprints`);
    if (s.chainHead) {
      console.log(`head:        ${s.chainHead.slice(0, 12)}`);
    }
  });

const keysCmd = program.command('keys').description('Manage signing keys');

keysCmd
  .command('add')
  .description("Register this device's key with the hub")
  .requiredOption('--label <label>', 'Device label (e.g. "MacBook Pro")')
  .action(async (opts) => {
    try {
      const result = await keysAdd(opts.label);
      console.log(`registered key ${result.fingerprint}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

keysCmd
  .command('list')
  .description("Show this device's key info")
  .action(async () => {
    const info = await keysList();
    console.log(`fingerprint: ${info.fingerprint}`);
    console.log(`pubkey:      ${info.pubkey}`);
  });

keysCmd
  .command('rotate')
  .description('Generate a new seed (old payloads become unreadable)')
  .action(async () => {
    console.log('WARNING: After rotation, payloads encrypted with the old seed cannot be decrypted.');
    console.log('Marks (your decision provenance) are permanent and unaffected.');
    const result = await keysRotate();
    console.log(`new key: ${result.fingerprint}`);
    console.log('Register the new key with: handprint keys add --label "..."');
  });

keysCmd
  .command('export')
  .description('Export seed for backup (handle with care)')
  .action(async () => {
    const seed = await keysExport();
    console.log(seed);
  });

const configCmd = program.command('config').description('Read or write configuration');

configCmd
  .command('show')
  .option('--global', 'Show global config')
  .action((opts) => {
    try {
      const config = getConfig(process.cwd(), opts.global ? 'global' : 'project');
      console.log(JSON.stringify(config, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command('get <path>')
  .option('--global', 'Read from global config')
  .action((path: string, opts) => {
    try {
      const config = getConfig(process.cwd(), opts.global ? 'global' : 'project');
      const value = getConfigValue(config as Record<string, unknown>, path);
      if (value === undefined) {
        console.error(`no value at path: ${path}`);
        process.exit(1);
      }
      console.log(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command('set <path> <value>')
  .option('--global', 'Write to global config')
  .action((path: string, value: string, opts) => {
    try {
      const config = getConfig(process.cwd(), opts.global ? 'global' : 'project') as Record<string, unknown>;
      const updated = setConfigValue(config, path, value);
      if (opts.global) {
        saveGlobalConfig(updated as any);
      } else {
        saveProjectConfig(process.cwd(), updated as any);
      }
      console.log(`set ${path} = ${JSON.stringify(getConfigValue(updated, path))}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

const skillCmd = program.command('skill').description('Manage the bundled /handprint Claude Code skill');

skillCmd
  .command('install')
  .description('Install the /handprint skill into ~/.claude/skills (or .claude/skills with --project)')
  .option('--project', 'Install into the current project .claude/skills instead of global')
  .option('--force', 'Overwrite even if already installed at the same version')
  .action((opts) => {
    try {
      const scope: 'global' | 'project' = opts.project ? 'project' : 'global';
      const result = installSkill({ scope, force: opts.force });
      console.log(`Installed the /handprint skill (v${result.version}) to ${result.path}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      process.exit(1);
    }
  });

skillCmd
  .command('uninstall')
  .description('Remove the /handprint skill from ~/.claude/skills (or .claude/skills with --project)')
  .option('--project', 'Remove from the current project .claude/skills instead of global')
  .action((opts) => {
    try {
      const scope: 'global' | 'project' = opts.project ? 'project' : 'global';
      const result = uninstallSkill({ scope });
      if (result.removed) {
        console.log(`Removed the /handprint skill from ${result.path}`);
      } else {
        console.log(`Skill not found at ${result.path} (nothing removed)`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      process.exit(1);
    }
  });

program
  .command('reset')
  .description('Delete the local handprint chain so you can re-ingest (identity and keys are kept)')
  .option('--force', 'Skip the confirmation prompt (for scripts)')
  .action(async (opts: { force?: boolean }) => {
    try {
      const confirm = async (plan: ResetPlan): Promise<boolean> => {
        if (!process.stdin.isTTY) return false;
        console.log(`\nThis permanently deletes ${plan.handprints} local handprint(s) from:`);
        console.log(`  ${plan.projectRoot}/.handprint`);
        console.log('It removes the stored objects, the chain log, and the grab watermark.');
        console.log('Your identity and signing keys are NOT affected, and handprints already');
        console.log('published to the hub are NOT affected.\n');
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question('Type "reset" to confirm: ');
        rl.close();
        return answer.trim() === 'reset';
      };
      const result = await reset(process.cwd(), { force: opts.force, confirm });
      if (result.needsConfirm) {
        console.log('Refusing to reset without a terminal to confirm. Re-run with --force.');
        return;
      }
      if (!result.confirmed) {
        console.log('Aborted. Nothing was deleted.');
        return;
      }
      console.log(`Reset complete. Deleted ${result.removed} local handprint(s). Run "handprint grab" to re-ingest.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(msg);
      process.exit(1);
    }
  });

program.parse();
