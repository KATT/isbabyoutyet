import { defineConfig } from "vitest/config";
import { createVitestAffectedPlugin } from "../../scripts/createVitestAffectedPlugin.ts";

export default defineConfig({
  plugins: [createVitestAffectedPlugin()],
  test: {
    name: "convex-prefetch",
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
