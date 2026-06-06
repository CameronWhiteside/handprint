#!/usr/bin/env npx tsx

import { Command } from "commander";
import { initStore } from "../src/commands/init.js";
import { sealHandprint } from "../src/commands/seal.js";
import { listHandprints } from "../src/commands/log.js";
import { showHandprint } from "../src/commands/show.js";
import { resolveHandprint } from "../src/commands/resolve.js";
import { exportHandprints } from "../src/commands/export.js";
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

program.parse();
