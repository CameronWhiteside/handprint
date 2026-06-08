import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { HANDPRINT_DIR } from "./init.js";
import { loadConfig, saveConfig } from "./config.js";

export interface PushResult {
  handle: string;
  keysWritten: number;
  namespaceId: string;
}

function getWranglerToken(): string {
  const configPath = join(
    process.env.HOME ?? "~",
    ".wrangler",
    "config",
    "default.toml",
  );
  if (!existsSync(configPath)) {
    throw new Error("no wrangler credentials — run 'wrangler login'");
  }
  const config = readFileSync(configPath, "utf-8");
  const match = config.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!match) throw new Error("no OAuth token in wrangler config");
  return match[1];
}

async function cfApi(
  path: string,
  token: string,
  method: string = "GET",
  body?: unknown,
): Promise<any> {
  const resp = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await resp.json();
  if (!data.success) {
    const errors =
      data.errors?.map((e: any) => e.message).join(", ") ?? "unknown error";
    throw new Error(`Cloudflare API: ${errors}`);
  }
  return data;
}

async function ensureNamespace(
  accountId: string,
  token: string,
  config: any,
  repoRoot: string,
): Promise<string> {
  if (config.remote.namespaceId) return config.remote.namespaceId;

  // Create KV namespace
  const data = await cfApi(
    `/accounts/${accountId}/storage/kv/namespaces`,
    token,
    "POST",
    { title: "handprint-profiles" },
  );
  const nsId = data.result.id;

  // Save to config
  config.remote.namespaceId = nsId;
  saveConfig(repoRoot, config);
  console.error(`created KV namespace: ${nsId}`);

  return nsId;
}

export async function push(repoRoot: string): Promise<PushResult> {
  const profilePath = join(repoRoot, HANDPRINT_DIR, "profile.json");
  if (!existsSync(profilePath)) {
    throw new Error("no profile.json — run 'handprint profile' first");
  }

  const profile = JSON.parse(readFileSync(profilePath, "utf-8"));
  const config = loadConfig(repoRoot);
  const token = getWranglerToken();

  const accountId = config.remote.accountId;
  if (!accountId) {
    throw new Error(
      "no accountId in config — run 'handprint config set remote.accountId <id>'",
    );
  }

  const nsId = await ensureNamespace(accountId, token, config, repoRoot);
  const handle = config.identity.handle;

  // Write profile
  await cfApi(
    `/accounts/${accountId}/storage/kv/namespaces/${nsId}/values/${handle}:profile`,
    token,
    "PUT",
    profile,
  );

  // Write meta (lightweight index entry)
  const meta = {
    handle,
    name: config.identity.name,
    total: profile.total,
    merkleRoot: profile.merkleRoot,
    lastPush: new Date().toISOString(),
  };
  await cfApi(
    `/accounts/${accountId}/storage/kv/namespaces/${nsId}/values/${handle}:meta`,
    token,
    "PUT",
    meta,
  );

  return { handle, keysWritten: 2, namespaceId: nsId };
}
