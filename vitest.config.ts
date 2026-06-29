import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "text"],
      include: ["src/**/*.ts"],
      // Thin CLI wiring/barrel is exercised via command tests; stubs throw.
      exclude: ["src/index.ts", "src/sources/codex.ts", "src/sources/cursor.ts"],
      // Floor set just below current levels to catch regressions without flakiness.
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 75,
        lines: 70,
      },
    },
  },
});
