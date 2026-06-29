import { Command } from 'commander';
import { createRequire } from 'node:module';
import { createInterface } from 'node:readline/promises';
import { init } from '../src/commands/init.js';
import { grab } from '../src/commands/grab.js';
import type { GrabPlan, GrabDecision } from '../src/commands/grab.js';
import { push } from '../src/commands/push.js';
import { verifyChain } from '../src/commands/verify.js';
import { listHandprints } from '../src/commands/log.js';
import { showHandprint } from '../src/commands/show.js';
import { status } from '../src/commands/status.js';
import { login } from '../src/commands/login.js';
import { keysAdd, keysList, keysRotate, keysExport } from '../src/commands/keys.js';
import { listSources } from '../src/commands/sources.js';
import {
  getConfig,
  getConfigValue,
  setConfigValue,
  saveGlobalConfig,
  saveProjectConfig,
} from '../src/commands/config.js';
// Item 7: read real version from package.json so dist/bin/handprint.js always
// reports the version declared in the tarball (../../package.json from dist/bin/).
const _require = createRequire(import.meta.url);

function isVersionedPackage(v: unknown): v is { version: string } {
  if (typeof v !== 'object' || v === null || !('version' in v)) return false;
  return typeof v.version === 'string';
}

const _pkg: unknown = _require('../../package.json');
const version = isVersionedPackage(_pkg) ? _pkg.version : '0.0.0';

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
  .option('-n, --limit <n>', 'Max sessions to scan', parseInt)
  .option('--source <id>', 'Only scan one source (claude-code, opencode)')
  .option('--project <name...>', 'Only sessions whose project path contains this (repeatable)')
  .option('--days <n>', 'Only sessions active in the last N days', parseInt)
  .option('--since <when>', 'Only sessions active on/after this (ISO date or relative like 7d)')
  .option('--until <when>', 'Only sessions active on/before this (ISO date or relative)')
  .option('--min-messages <n>', 'Skip sessions with fewer than N messages', parseInt)
  .option('--redo', 'Re-grab sessions already in the local chain (default: skip them)')
  .option('--extractor <kind>', 'Extractor: local | host | openai')
  .option('-y, --yes', 'Skip the confirm step and process everything (for agents/scripts)')
  .option('--dry-run', 'Quick scan: preview scope without processing or confirming')
  .action(async (opts) => {
    try {
      const onDownload = async (entry: { id: string; sizeMb: number }) => {
        if (!process.stdin.isTTY) return false;
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question(`Download local model ${entry.id} (${entry.sizeMb} MB)? [y/N] `);
        rl.close();
        return answer.trim().toLowerCase() === 'y';
      };

      const isTty = Boolean(process.stdin.isTTY && process.stdout.isTTY);
      const confirm = isTty
        ? async (plan: GrabPlan): Promise<GrabDecision> => {
            console.log(
              `\nFound ${plan.totalSessions} session(s), ${plan.totalMessages} message(s), ~${plan.totalChunks} model call(s) across ${plan.projects.length} project(s):`,
            );
            plan.projects.forEach((pr, i) => {
              console.log(
                `  [${i + 1}] ${pr.project}  ${pr.sessions} session(s) · ${pr.messages} msgs · ${pr.chunks} chunks`,
              );
            });
            console.log(`Extractor: ${plan.extractor}`);
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
      const extractor: 'local' | 'host' | 'openai' | undefined =
        opts.extractor === 'ollama' ? 'openai' : opts.extractor;

      const result = await grab(process.cwd(), {
        limit: opts.limit,
        source: opts.source,
        project: opts.project,
        days: opts.days,
        since: opts.since,
        until: opts.until,
        minMessages: opts.minMessages,
        redo: opts.redo,
        extractor,
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

      if (result.blockedReason) {
        console.log(`\nCannot run the ${plan.extractor} extractor:\n${result.blockedReason}\n`);
        return;
      }

      const printScope = () => {
        console.log(
          `\n${plan.totalSessions} session(s), ${plan.totalMessages} message(s), ~${plan.totalChunks} model call(s) across ${plan.projects.length} project(s):`,
        );
        for (const pr of plan.projects) {
          console.log(`  ${pr.project}  ${pr.sessions} · ${pr.messages} msgs · ${pr.chunks} chunks`);
        }
        console.log(`Extractor: ${plan.extractor}`);
        const skips: string[] = [];
        if (plan.skippedAlreadyGrabbed) skips.push(`${plan.skippedAlreadyGrabbed} already grabbed`);
        if (plan.skippedUnchanged) skips.push(`${plan.skippedUnchanged} with no new activity`);
        if (plan.skippedTooSmall) skips.push(`${plan.skippedTooSmall} below --min-messages`);
        if (plan.skippedOutOfRange) skips.push(`${plan.skippedOutOfRange} outside the time window`);
        if (skips.length) console.log(`Skipped: ${skips.join(', ')}.`);
      };

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
          `\nno decisions found (${result.sessionsProcessed} session(s), ${result.messagesProcessed} messages, ${secs}s).`,
        );
        return;
      }

      console.log(
        `\n${result.handprintsCreated} handprint(s) from ${result.sessionsProcessed} session(s) in ${secs}s\n`,
      );
      for (const { hash, marks } of result.details) {
        const prefix = `  ${hash.slice(0, 10)}  `;
        for (const m of marks) {
          const symbol = { vision: 'o', choice: '+', method: '*' }[m.type] ?? '?';
          console.log(`${prefix}${symbol} [${m.type}/${m.subtype}]  ${m.note}`);
        }
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
      console.log(`pushed ${result.pushed} handprints (${result.skipped} skipped)`);
    } catch (err) {
      console.error((err as Error).message);
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

program.parse();
