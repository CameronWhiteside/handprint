import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      // libsodium-wrappers ESM build is broken (missing libsodium.mjs sibling).
      // Alias to the CJS build so Vite can bundle it correctly.
      "libsodium-wrappers": path.resolve(
        "./node_modules/libsodium-wrappers/dist/modules/libsodium-wrappers.js"
      ),
    },
  },
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
  },
});
