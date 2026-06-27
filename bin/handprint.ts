import { Command } from 'commander';
import { init } from '../src/commands/init.js';
import { grab } from '../src/commands/grab.js';
import { push } from '../src/commands/push.js';
import { verifyChain } from '../src/commands/verify.js';
import { listHandprints } from '../src/commands/log.js';
import { showHandprint } from '../src/commands/show.js';
import { status } from '../src/commands/status.js';
import { login } from '../src/commands/login.js';
import { keysAdd, keysList, keysRotate, keysExport } from '../src/commands/keys.js';
import {
  getConfig,
  getConfigValue,
  setConfigValue,
  saveGlobalConfig,
  saveProjectConfig,
} from '../src/commands/config.js';
import type { Visibility } from '@handprint/types';

const program = new Command();

program
  .name('handprint')
  .description('Human decision provenance for the age of AI')
  .version('0.2.0');

program
  .command('init')
  .description('Initialize handprint (global identity + project)')
  .option('--global', 'Initialize global identity at ~/.handprint/')
  .option('--visibility <level>', 'Project visibility: private, unlisted, public', 'private')
  .action(async (opts) => {
    try {
      const path = await init(process.cwd(), {
        global: opts.global,
        visibility: opts.visibility as Visibility,
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
  .command('grab')
  .description('Extract decisions from AI transcripts')
  .option('-n, --limit <n>', 'Sessions to scan', parseInt)
  .option('--dry-run', 'Show what would be extracted')
  .action(async (opts) => {
    try {
      const result = await grab(process.cwd(), {
        limit: opts.limit,
        dryRun: opts.dryRun,
      });

      if (result.handprintsCreated === 0) {
        console.log('no decisions found');
        return;
      }

      console.log(
        `\n${result.handprintsCreated} handprints from ${result.sessionsScanned} sessions\n`,
      );

      for (const { hash, marks } of result.details) {
        const prefix = opts.dryRun ? '  ' : `  ${hash.slice(0, 10)}  `;
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
      if (result.visibility === 'private') {
        console.log('project is private — nothing pushed');
        return;
      }
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
        console.log('status: valid — all hashes verified, signatures valid, chain intact');
      } else {
        console.log('status: INVALID');
        for (const { hash, error } of result.errors) {
          console.log(`  ${hash.slice(0, 12)} — ${error}`);
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
    console.log(`visibility:  ${s.visibility ?? 'n/a (no project)'}`);
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
