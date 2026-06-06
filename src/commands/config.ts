import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execSync } from "node:child_process";
import { HANDPRINT_DIR } from "./init.js";
import { type HandprintConfig, DEFAULT_PROTOCOL } from "../profile/types.js";

export function configPath(repoRoot: string): string {
  return join(repoRoot, HANDPRINT_DIR, "config.json");
}

export function loadConfig(repoRoot: string): HandprintConfig {
  const path = configPath(repoRoot);
  if (!existsSync(path)) throw new Error("not initialized: run 'handprint init' first");
  const raw = JSON.parse(readFileSync(path, "utf-8"));

  // Merge with defaults for any missing fields (backwards compat)
  return {
    version: raw.version ?? "0.1.0",
    createdAt: raw.createdAt ?? new Date().toISOString(),
    identity: raw.identity ?? detectIdentity(),
    remote: raw.remote ?? { type: "cloudflare-kv", accountId: "", namespaceId: null },
    protocol: deepMerge(DEFAULT_PROTOCOL, raw.protocol ?? {}),
  };
}

export function saveConfig(repoRoot: string, config: HandprintConfig): void {
  writeFileSync(configPath(repoRoot), JSON.stringify(config, null, 2));
}

export function getConfigValue(config: HandprintConfig, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = config;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export function setConfigValue(config: HandprintConfig, path: string, value: unknown): HandprintConfig {
  const parts = path.split(".");
  const result = JSON.parse(JSON.stringify(config));
  let current = result;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!(parts[i] in current)) current[parts[i]] = {};
    current = current[parts[i]];
  }
  // Try to parse as number or boolean
  if (typeof value === "string") {
    if (value === "true") value = true;
    else if (value === "false") value = false;
    else if (!isNaN(Number(value)) && value !== "") value = Number(value);
  }
  current[parts[parts.length - 1]] = value;
  return result;
}

export function detectIdentity(): HandprintConfig["identity"] {
  try {
    const name = execSync("git config user.name", { encoding: "utf-8" }).trim();
    const email = execSync("git config user.email", { encoding: "utf-8" }).trim();
    const handle = "@" + name.toLowerCase().replace(/\s+/g, "");
    return { handle, name, email };
  } catch {
    return { handle: "@unknown", name: "Unknown", email: "" };
  }
}

function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>): any {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] && typeof source[key] === "object" && !Array.isArray(source[key]) &&
        target[key] && typeof target[key] === "object" && !Array.isArray(target[key])) {
      result[key] = deepMerge(target[key] as Record<string, unknown>, source[key] as Record<string, unknown>);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
