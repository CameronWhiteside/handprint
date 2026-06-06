#!/usr/bin/env npx tsx

import { Command } from "commander";
import { initStore } from "../src/commands/init.js";
import { sealHandprint } from "../src/commands/seal.js";
import { listHandprints } from "../src/commands/log.js";
import { showHandprint } from "../src/commands/show.js";
import { resolveHandprint } from "../src/commands/resolve.js";
import { exportHandprints } from "../src/commands/export.js";
import { scan } from "../src/commands/scan.js";
import { ingest } from "../src/commands/ingest.js";
import { loadConfig, saveConfig, getConfigValue, setConfigValue } from "../src/commands/config.js";
import { HandprintType } from "../src/model/handprint.js";
import { ResolutionStatus } from "../src/model/resolution.js";

const program = new Command();

program
  .name("handprint")
  .description("Human decision provenance for the age of AI")
  .version("0.1.0");

program
  .command("init")
  .description("Initialize a new handprint store")
  .action(() => {
    try {
      const path = initStore(process.cwd());
      console.log(path);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("seal")
  .description("Seal a new handprint")
  .requiredOption("-t, --type <type>", `handprint type (${Object.values(HandprintType).join(", ")})`)
  .requiredOption("-i, --intent <intent>", "what you intend to achieve")
  .requiredOption("-r, --risk <risk>", "what could go wrong")
  .requiredOption("-c, --context <context>", "relevant context for this decision")
  .option("--horizon <horizon>", "time horizon for evaluation")
  .option("--confidence <n>", "confidence level (0-1)", parseFloat)
  .option("-s, --source <source>", "source of the decision")
  .action((opts) => {
    try {
      const hash = sealHandprint(process.cwd(), {
        type: opts.type as HandprintType,
        intent: opts.intent,
        risk: opts.risk,
        context: opts.context,
        horizon: opts.horizon ?? null,
        confidence: opts.confidence ?? null,
        source: opts.source ?? null,
      });
      console.log(`sealed ${hash.slice(0, 12)}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("log")
  .description("List sealed handprints")
  .option("-t, --type <type>", "filter by handprint type")
  .action((opts) => {
    const entries = listHandprints(process.cwd(), opts.type ? { type: opts.type as HandprintType } : undefined);
    if (entries.length === 0) {
      console.log("no handprints yet");
      return;
    }
    for (const entry of entries) {
      const hash10 = entry.hash.slice(0, 10);
      const typePadded = entry.type.padEnd(11);
      const date = entry.timestamp.slice(0, 10);
      console.log(`${hash10}  ${typePadded}  ${date}  ${entry.intent}`);
    }
  });

program
  .command("show <ref>")
  .description("Show a handprint by hash or prefix")
  .action((ref: string) => {
    const detail = showHandprint(process.cwd(), ref);
    if (!detail) {
      console.error("handprint not found");
      process.exit(1);
    }
    console.log(JSON.stringify(detail, null, 2));
  });

program
  .command("resolve <ref>")
  .description("Resolve a handprint")
  .requiredOption("-s, --status <status>", `resolution status (${Object.values(ResolutionStatus).join(", ")})`)
  .requiredOption("-b, --body <body>", "resolution body")
  .option("-l, --learnings <items>", "comma-separated learnings")
  .action((ref: string, opts) => {
    try {
      const hash = resolveHandprint(process.cwd(), {
        handprintRef: ref,
        status: opts.status as ResolutionStatus,
        body: opts.body,
        learnings: opts.learnings ? opts.learnings.split(",").map((s: string) => s.trim()) : undefined,
      });
      console.log(`resolved → ${hash.slice(0, 12)}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("export")
  .description("Export all handprints with resolutions as JSON")
  .action(() => {
    try {
      const result = exportHandprints(process.cwd());
      console.log(JSON.stringify(result, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("scan")
  .description("Scan git history and Claude Code transcripts for handprint candidates")
  .option("-n, --limit <n>", "Number of git commits to scan", "50")
  .action(() => {
    const result = scan(process.cwd());
    const total = result.gitCandidates.length + result.transcriptCandidates.length;

    if (total === 0) {
      console.log("no handprint candidates found");
      return;
    }

    if (result.gitCandidates.length > 0) {
      console.log(`\n— git commits (${result.gitCandidates.length}) —`);
      for (const c of result.gitCandidates) {
        console.log(`  ${c.commit.hash.slice(0, 7)}  [${c.suggestedType}]  ${c.commit.message}`);
      }
    }

    if (result.transcriptCandidates.length > 0) {
      console.log(`\n— claude code (${result.transcriptCandidates.length}) —`);
      for (const c of result.transcriptCandidates) {
        const preview = c.pair.user.text.slice(0, 80);
        console.log(`  [${c.suggestedType}]  "${preview}${c.pair.user.text.length > 80 ? "..." : ""}"`);
      }
    }

    console.log(`\n${total} candidates found. Use 'handprint ingest' to auto-extract.`);
  });

program
  .command("ingest")
  .description("Auto-extract handprints from Claude Code transcripts using AI")
  .option("-n, --limit <n>", "Number of recent sessions to scan", parseInt)
  .option("--dry-run", "Show what would be extracted without sealing")
  .action(async (opts) => {
    try {
      const result = await ingest(process.cwd(), {
        limit: opts.limit,
        dryRun: opts.dryRun,
      });

      if (result.sealed.length === 0) {
        console.log("no handprints found");
        return;
      }

      const verb = opts.dryRun ? "found" : "sealed";
      console.log(`\n${result.sealed.length} handprints ${verb} from ${result.sessionsScanned} sessions (${result.messagesAnalyzed} messages analyzed)\n`);

      for (const { hash, handprint } of result.sealed) {
        const prefix = opts.dryRun ? "  " : `  ${hash.slice(0, 10)}  `;
        const symbol = { direction: "→", override: "⤴", rejection: "⌀", constraint: "▮", wager: "◇" }[handprint.type] ?? "?";
        console.log(`${prefix}${symbol} [${handprint.type}]  ${handprint.intent}`);
        console.log(`${" ".repeat(prefix.length)}  "${handprint.quote}"`);
        console.log();
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

const configCmd = program
  .command("config")
  .description("Read or write handprint configuration");

configCmd
  .command("show")
  .description("Dump full config as JSON")
  .action(() => {
    try {
      const config = loadConfig(process.cwd());
      console.log(JSON.stringify(config, null, 2));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command("get <path>")
  .description("Get a config value by dot-separated path")
  .action((path: string) => {
    try {
      const config = loadConfig(process.cwd());
      const value = getConfigValue(config, path);
      if (value === undefined) {
        console.error(`no value at path: ${path}`);
        process.exit(1);
      }
      console.log(typeof value === "object" ? JSON.stringify(value, null, 2) : String(value));
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

configCmd
  .command("set <path> <value>")
  .description("Set a config value by dot-separated path")
  .action((path: string, value: string) => {
    try {
      const config = loadConfig(process.cwd());
      const updated = setConfigValue(config, path, value);
      saveConfig(process.cwd(), updated);
      console.log(`set ${path} = ${JSON.stringify(getConfigValue(updated, path))}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
