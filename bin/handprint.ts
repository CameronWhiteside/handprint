#!/usr/bin/env npx tsx

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { initStore, HANDPRINT_DIR } from "../src/commands/init.js";
import { sealHandprint } from "../src/commands/seal.js";
import { listHandprints } from "../src/commands/log.js";
import { showHandprint } from "../src/commands/show.js";
import { resolveHandprint } from "../src/commands/resolve.js";
import { exportHandprints } from "../src/commands/export.js";
import { scan } from "../src/commands/scan.js";
import { verifyChain } from "../src/commands/verify.js";
import { ingest } from "../src/commands/ingest.js";
import { loadConfig, saveConfig, getConfigValue, setConfigValue } from "../src/commands/config.js";
import { computeProfile } from "../src/profile/compute.js";
import { getRef } from "../src/store/refs.js";
import { push } from "../src/commands/push.js";
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
  .command("verify")
  .description("Verify the integrity of the hash chain")
  .action(() => {
    try {
      const result = verifyChain(process.cwd());

      if (result.chainLength === 0) {
        console.log("chain: empty (no handprints sealed yet)");
        console.log("status: ✓ valid");
        return;
      }

      console.log(`chain: ${result.chainLength} handprint${result.chainLength === 1 ? "" : "s"}`);
      console.log(`head: ${result.head!.slice(0, 12)}`);

      if (result.valid) {
        console.log("status: ✓ valid — all hashes verified, chain intact");
      } else {
        console.log("status: ✗ INVALID");
        console.log("errors:");
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

const grabAction = async (opts: { limit?: number; dryRun?: boolean }) => {
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
      const symbol = { vision: "◎", choice: "⊕", method: "⚙" }[handprint.type] ?? "?";
      console.log(`${prefix}${symbol} [${handprint.type}]  ${handprint.intent}`);
      console.log(`${" ".repeat(prefix.length)}  "${handprint.quote}"`);
      console.log();
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
};

program
  .command("grab")
  .description("Auto-extract handprints from Claude Code transcripts using AI")
  .option("-n, --limit <n>", "Number of recent sessions to scan", parseInt)
  .option("--dry-run", "Show what would be extracted without sealing")
  .action(grabAction);

program
  .command("ingest", { hidden: true })
  .description("Alias for grab")
  .option("-n, --limit <n>", "Number of recent sessions to scan", parseInt)
  .option("--dry-run", "Show what would be extracted without sealing")
  .action(grabAction);

program
  .command("sign")
  .description("Select and sign handprints for publishing")
  .action(() => console.log("coming soon"));

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

program
  .command("profile")
  .description("Compute and write the handprint profile")
  .action(() => {
    try {
      const cwd = process.cwd();
      const config = loadConfig(cwd);
      const exported = exportHandprints(cwd);
      const hpDir = join(cwd, HANDPRINT_DIR);
      const head = getRef(hpDir, "HEAD");
      const profile = computeProfile(exported.handprints, config, head);

      const outPath = join(hpDir, "profile.json");
      writeFileSync(outPath, JSON.stringify(profile, null, 2), "utf-8");

      console.log(`profile written to ${outPath}`);
      console.log();
      console.log(`  handle:   ${profile.handle}`);
      console.log(`  total:    ${profile.total} handprints`);
      console.log(`  types:    ${Object.entries(profile.typeCounts).filter(([_, v]) => v > 0).map(([k, v]) => `${v} ${k}`).join(", ")}`);
      if (profile.calibration.score !== null) {
        console.log(`  calibr:   ${(profile.calibration.score * 100).toFixed(1)}% (${profile.calibration.resolved} resolved)`);
      } else {
        console.log(`  calibr:   pending (${profile.calibration.resolved}/${config.protocol.calibration.minResolved} resolved)`);
      }
      console.log(`  domains:  ${profile.domains.map((d) => `${d.name} (${d.count})`).join(", ") || "none"}`);
      console.log(`  streak:   ${profile.streak.current}d current, ${profile.streak.longest}d longest`);
      if (profile.merkleRoot) {
        console.log(`  chain:    ${profile.merkleRoot.slice(0, 12)}`);
      }
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("push")
  .description("Push profile to Cloudflare KV for publishing on handprint.sh")
  .action(async () => {
    try {
      const result = await push(process.cwd());
      console.log(`pushed ${result.handle} to KV (${result.keysWritten} keys)`);
      console.log(`namespace: ${result.namespaceId}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
