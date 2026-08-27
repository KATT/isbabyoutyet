import { defineConfig } from "vitest/config";
import { createVitestAffectedPlugin } from "../scripts/createVitestAffectedPlugin.ts";

export default defineConfig({
  plugins: [createVitestAffectedPlugin()],
  test: {
    name: "oxlint-plugins",
    // Run from repo root (`vitest --config oxlint-plugins/vitest.config.ts`).
    // Keep the glob rooted under oxlint-plugins so we never pick up package/app tests.
    include: ["oxlint-plugins/**/*.test.ts"],
    environment: "node",
  },
});
