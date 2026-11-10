import { defineConfig } from "vitest/config";
import path from "node:path";

// Integration tests: real PostgreSQL from docker-compose.test.yml (see tests/integration/global-setup.ts).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(import.meta.dirname, "src") } },
  test: {
    environment: "node",
    globalSetup: ["tests/integration/global-setup.ts"],
    include: ["tests/integration/**/*.spec.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
