import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained server output for the Docker image.
  output: "standalone",
  // The project already has CLAUDE.md; do not auto-generate AGENTS.md on `next dev`.
  agentRules: false,
  // Gallery uploads go through a server action (5 MB image limit enforced in the action).
  experimental: { serverActions: { bodySizeLimit: "6mb" } },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default withNextIntl(nextConfig);
