#!/usr/bin/env npx tsx

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { Command } from "commander";
import { initStore, HANDPRINT_DIR } from "../src/commands/init.js";
import { sealChunk } from "../src/commands/seal.js";
import { listSeals, listDecisions } from "../src/commands/log.js";
import { showSeal } from "../src/commands/show.js";
import { exportHandprints } from "../src/commands/export.js";
import { scan } from "../src/commands/scan.js";
import { verifyChain } from "../src/commands/verify.js";
import { grab } from "../src/commands/grab.js";
import { loadConfig, saveConfig, getConfigValue, setConfigValue } from "../src/commands/config.js";
import { computeProfile } from "../src/profile/compute.js";
import { listAllMeta } from "../src/store/meta.js";
import { getRef } from "../src/store/refs.js";
import { push } from "../src/commands/push.js";

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
  .description("Seal a conversation chunk (low-level)")
  .requiredOption("-s, --session <session>", "session/chat ID")
  .requiredOption("-p, --project <project>", "project identifier")
  .requiredOption("--plaintext <text>", "plaintext conversation to seal")
  .option("--ts <timestamp>", "ISO timestamp", new Date().toISOString())
  .option("--author <author>", "author identity", "unknown")
  .action((opts) => {
    try {
      const hash = sealChunk(process.cwd(), {
        ts: opts.ts,
        session: opts.session,
        project: opts.project,
        author: opts.author,
        plaintext: opts.plaintext,
      });
      console.log(`sealed ${hash.slice(0, 12)}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program
  .command("log")
  .description("List decisions (meta entries)")
  .option("-t, --type <type>", "filter by decision type (vision, choice, method)")
  .option("--seals", "list seals instead of decisions")
  .action((opts) => {
    if (opts.seals) {
      const entries = listSeals(process.cwd());
      if (entries.length === 0) {
        console.log("no seals yet");
        return;
      }
      for (const entry of entries) {
        const hash10 = entry.hash.slice(0, 10);
        const ts = entry.seal.ts?.slice(0, 10) ?? "unknown";
        const session = entry.seal.session?.slice(0, 8) ?? "unknown";
        console.log(`${hash10}  ${ts}  session:${session}  ${entry.seal.project ?? ""}`);
      }
    } else {
      const metas = listDecisions(process.cwd(), opts.type ? { type: opts.type } : undefined);
      if (metas.length === 0) {
        console.log("no decisions yet");
        return;
      }
      for (const m of metas) {
        const sealPrefix = m.seal.slice(0, 10);
        const typePadded = m.type.padEnd(8);
        const subtype = m.subtype ? `(${m.subtype})` : "";
        console.log(`${sealPrefix}  ${typePadded} ${subtype.padEnd(14)} ${m.intent}`);
      }
    }
  });

program
  .command("show <ref>")
  .description("Show a seal by hash or prefix")
  .option("--decrypt", "Decrypt the sealed payload")
  .action((ref: string, opts) => {
    const detail = showSeal(process.cwd(), ref, {
      decryptPayload: opts.decrypt,
    });
    if (!detail) {
      console.error("seal not found");
      process.exit(1);
    }
    console.log(JSON.stringify(detail, null, 2));
  });

program
  .command("verify")
  .description("Verify the integrity of the seal chain")
  .action(() => {
    try {
      const result = verifyChain(process.cwd());

      if (result.chainLength === 0) {
        console.log("chain: empty (no seals yet)");
        console.log("status: valid");
        return;
      }

      console.log(
        `chain: ${result.chainLength} seal${result.chainLength === 1 ? "" : "s"}`,
      );
      console.log(`head: ${result.head!.slice(0, 12)}`);

      if (result.valid) {
        console.log(
          "status: valid — all hashes verified, signatures valid, chain intact",
        );
      } else {
        console.log("status: INVALID");
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
  .command("export")
  .description("Export all seals and meta entries as JSON")
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
    const total =
      result.gitCandidates.length + result.transcriptCandidates.length;

    if (total === 0) {
      console.log("no handprint candidates found");
      return;
    }

    if (result.gitCandidates.length > 0) {
      console.log(`\n-- git commits (${result.gitCandidates.length}) --`);
      for (const c of result.gitCandidates) {
        console.log(
          `  ${c.commit.hash.slice(0, 7)}  [${c.suggestedType}]  ${c.commit.message}`,
        );
      }
    }

    if (result.transcriptCandidates.length > 0) {
      console.log(
        `\n-- claude code (${result.transcriptCandidates.length}) --`,
      );
      for (const c of result.transcriptCandidates) {
        const preview = c.pair.user.text.slice(0, 80);
        console.log(
          `  [${c.suggestedType}]  "${preview}${c.pair.user.text.length > 80 ? "..." : ""}"`,
        );
      }
    }

    console.log(
      `\n${total} candidates found. Use 'handprint grab' to auto-extract.`,
    );
  });

const grabAction = async (opts: { limit?: number; dryRun?: boolean }) => {
  try {
    const result = await grab(process.cwd(), {
      limit: opts.limit,
      dryRun: opts.dryRun,
    });

    if (result.sealsCreated === 0 && result.decisionsExtracted === 0) {
      console.log("no decisions found");
      return;
    }

    const verb = opts.dryRun ? "found" : "sealed";
    console.log(
      `\n${result.sealsCreated} chunks ${verb}, ${result.decisionsExtracted} decisions extracted from ${result.sessionsScanned} sessions\n`,
    );

    for (const { sealHash, decisions } of result.details) {
      const prefix = opts.dryRun ? "  " : `  ${sealHash.slice(0, 10)}  `;
      for (const hp of decisions) {
        const symbol =
          { vision: "o", choice: "+", method: "*" }[hp.type] ?? "?";
        const subLabel = hp.subtype ? `/${hp.subtype}` : "";
        console.log(
          `${prefix}${symbol} [${hp.type}${subLabel}]  ${hp.intent}`,
        );
        console.log(`${" ".repeat(prefix.length)}  "${hp.quote}"`);
        console.log();
      }
    }
  } catch (err) {
    console.error((err as Error).message);
    process.exit(1);
  }
};

program
  .command("grab")
  .description(
    "Auto-extract decisions from Claude Code transcripts using AI",
  )
  .option(
    "-n, --limit <n>",
    "Number of recent sessions to scan",
    parseInt,
  )
  .option("--dry-run", "Show what would be extracted without sealing")
  .action(grabAction);

program
  .command("ingest", { hidden: true })
  .description("Alias for grab")
  .option(
    "-n, --limit <n>",
    "Number of recent sessions to scan",
    parseInt,
  )
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
      console.log(
        typeof value === "object"
          ? JSON.stringify(value, null, 2)
          : String(value),
      );
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
      console.log(
        `set ${path} = ${JSON.stringify(getConfigValue(updated, path))}`,
      );
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
      const hpDir = join(cwd, HANDPRINT_DIR);
      const head = getRef(hpDir, "HEAD");
      const metas = listAllMeta(hpDir);
      const profile = computeProfile(metas, config, head);

      const outPath = join(hpDir, "profile.json");
      writeFileSync(outPath, JSON.stringify(profile, null, 2), "utf-8");

      console.log(`profile written to ${outPath}`);
      console.log();
      console.log(`  handle:   ${profile.handle}`);
      console.log(`  total:    ${profile.total} decisions`);
      console.log(
        `  types:    ${Object.entries(profile.typeCounts)
          .filter(([_, v]) => v > 0)
          .map(([k, v]) => `${v} ${k}`)
          .join(", ")}`,
      );
      if (profile.calibration.score !== null) {
        console.log(
          `  calibr:   ${(profile.calibration.score * 100).toFixed(1)}% (${profile.calibration.resolved} resolved)`,
        );
      } else {
        console.log(
          `  calibr:   pending (${profile.calibration.resolved}/${config.protocol.calibration.minResolved} resolved)`,
        );
      }
      console.log(
        `  domains:  ${profile.domains.map((d) => `${d.name} (${d.count})`).join(", ") || "none"}`,
      );
      console.log(
        `  streak:   ${profile.streak.current}d current, ${profile.streak.longest}d longest`,
      );
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
  .description(
    "Push profile to Cloudflare KV for publishing on handprint.sh",
  )
  .action(async () => {
    try {
      const result = await push(process.cwd());
      console.log(
        `pushed ${result.handle} to KV (${result.keysWritten} keys)`,
      );
      console.log(`namespace: ${result.namespaceId}`);
    } catch (err) {
      console.error((err as Error).message);
      process.exit(1);
    }
  });

program.parse();
