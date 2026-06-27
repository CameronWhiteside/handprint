import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { handprint: 'bin/handprint.ts' },
  format: ['esm'],
  outDir: 'dist/bin',
  target: 'node20',
  bundle: true,
  splitting: false,
  clean: true,
  shims: false,
  dts: false,
  // Optional native dependency that must not be bundled; it is resolved at runtime
  // only when the local-model provider is used (and installed).
  external: ['node-llama-cpp'],
  banner: { js: '#!/usr/bin/env node' },
});
