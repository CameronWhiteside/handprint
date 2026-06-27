import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadGlobalConfig, globalDir } from '../dirs/global.js';
import { createHubClient } from '../hub/client.js';

export async function login(): Promise<{ handle: string }> {
  const config = loadGlobalConfig();
  const client = createHubClient(config.hub.url);

  const { deviceCode, userCode, verificationUrl, interval } =
    await client.deviceCodeStart();

  console.log(`\nOpen this URL in your browser:\n  ${verificationUrl}\n`);
  console.log(`Enter this code: ${userCode}\n`);
  console.log('Waiting for authorization...');

  let token: string | null = null;
  const maxAttempts = 60;
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, interval * 1000));
    const result = await client.deviceCodePoll(deviceCode);
    if (result) {
      token = result.accessToken;
      break;
    }
  }

  if (!token) {
    throw new Error('login timed out');
  }

  const credPath = join(globalDir(), 'credentials.json');
  writeFileSync(
    credPath,
    JSON.stringify({ accessToken: token }, null, 2),
    { mode: 0o600 },
  );

  return { handle: config.identity.handle };
}
