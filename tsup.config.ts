import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { handprint: 'bin/handprint.ts' },
  format: ['esm'],
  outDir: 'dist/bin',
  target: 'node22',
  bundle: true,
  splitting: false,
  clean: true,
  shims: false,
  dts: false,
  banner: { js: '#!/usr/bin/env node' },
});
