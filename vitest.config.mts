import { defineConfig } from "vitest/config";
import path from "node:path";

// tests/unit/*.test.ts use node:test (run via `npm run test:node`), so Vitest only
// picks up *.spec.ts files to avoid running them twice.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    include: ["tests/vitest/**/*.spec.ts", "src/**/*.spec.ts"],
  },
});
