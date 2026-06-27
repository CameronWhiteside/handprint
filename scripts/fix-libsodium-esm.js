// libsodium-wrappers ESM build imports ./libsodium.mjs but doesn't bundle it.
// Symlink from the libsodium base package to fix the broken import.
import { existsSync, symlinkSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

const target = resolve(root, 'node_modules/libsodium/dist/modules-esm/libsodium.mjs');
const link = resolve(root, 'node_modules/libsodium-wrappers/dist/modules-esm/libsodium.mjs');

if (existsSync(target) && !existsSync(link)) {
  symlinkSync(target, link);
}
