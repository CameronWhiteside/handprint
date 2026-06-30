import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createServer, type Server } from 'node:http';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { loadGlobalConfig, globalDir } from '../dirs/global.js';
import { createHubClient, type HubClient } from '../hub/client.js';

const SUCCESS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>handprint</title>
<style>body{font-family:ui-sans-serif,system-ui,sans-serif;background:#faf8f5;color:#1a1a1a;display:grid;place-items:center;height:100vh;margin:0}
.card{text-align:center;max-width:28rem;padding:2rem}h1{color:#b7410e;font-size:1.5rem;margin:0 0 .5rem}p{color:#555}</style></head>
<body><div class="card"><h1>Signed in to handprint</h1><p>You can close this tab and return to your terminal.</p></div></body></html>`;

/** Open a URL in the default browser. Best-effort; the URL is also printed. */
function openBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === 'darwin' ? 'open' : platform === 'win32' ? 'cmd' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: 'ignore', detached: true });
    child.on('error', () => {});
    child.unref();
  } catch {
    // Ignore: the caller prints the URL as a fallback.
  }
}

interface Loopback {
  port: number;
  done: Promise<void>;
  close: () => void;
}

/** Start a localhost server that resolves `done` when the OAuth callback returns. */
function startLoopback(nonce: string): Promise<Loopback> {
  return new Promise((resolve, reject) => {
    let signal: () => void = () => {};
    const done = new Promise<void>((r) => {
      signal = r;
    });
    const server: Server = createServer((req, res) => {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/callback' && url.searchParams.get('state') === nonce) {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(SUCCESS_HTML);
        signal();
      } else {
        res.writeHead(404, { 'content-type': 'text/plain' });
        res.end('not found');
      }
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address();
      if (addr && typeof addr === 'object') {
        resolve({ port: addr.port, done, close: () => server.close() });
      } else {
        reject(new Error('could not bind a loopback port'));
      }
    });
  });
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Poll for the token. Polls fast once the loopback signals the browser is done. */
async function waitForToken(
  client: HubClient,
  deviceCode: string,
  intervalSeconds: number,
  timeoutMs: number,
  done?: Promise<void>,
): Promise<string | null> {
  const deadline = Date.now() + timeoutMs;
  let signaled = false;
  done?.then(() => {
    signaled = true;
  });
  while (Date.now() < deadline) {
    const result = await client.deviceCodePoll(deviceCode);
    if (result) return result.accessToken;
    await sleep(signaled ? 500 : Math.max(1, intervalSeconds) * 1000);
  }
  return null;
}

export interface LoginOptions {
  log?: (line: string) => void;
  open?: (url: string) => void;
  client?: HubClient;
  timeoutMs?: number;
}

export async function login(options: LoginOptions = {}): Promise<{ handle: string }> {
  const log = options.log ?? ((l: string) => console.log(l));
  const open = options.open ?? openBrowser;
  const timeoutMs = options.timeoutMs ?? 180_000;
  const config = loadGlobalConfig();
  const client = options.client ?? createHubClient(config.hub.url);

  const { deviceCode, userCode, interval } = await client.deviceCodeStart();
  const nonce = randomBytes(16).toString('hex');

  // The loopback server is best-effort polish (a local success page + a fast
  // finish). Polling is the source of truth, so login still works over SSH or
  // if the port cannot bind. The userCode rides in the OAuth state, so there is
  // never a code to type.
  const loopback = await startLoopback(nonce).catch(() => null);
  const portPart = loopback ? `:${loopback.port}:${nonce}` : '';
  const state = `device:${userCode}${portPart}`;
  const authUrl = `${config.hub.url}/api/auth/login/github?state=${encodeURIComponent(state)}`;

  log('\nOpening your browser to sign in with GitHub...');
  log(`If it does not open, visit this URL:\n  ${authUrl}\n`);
  log('Waiting for authorization...');
  open(authUrl);

  const token = await waitForToken(client, deviceCode, interval, timeoutMs, loopback?.done);
  loopback?.close();

  if (!token) {
    throw new Error('login timed out. Run `handprint login` again.');
  }

  const credPath = join(globalDir(), 'credentials.json');
  writeFileSync(credPath, JSON.stringify({ accessToken: token }, null, 2), { mode: 0o600 });

  return { handle: config.identity.handle };
}
