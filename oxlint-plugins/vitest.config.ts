import { defineConfig } from "vitest/config";
import { createVitestAffectedPlugin } from "../scripts/createVitestAffectedPlugin.ts";

export default defineConfig({
  plugins: [createVitestAffectedPlugin()],
  test: {
    name: "oxlint-plugins",
    include: ["**/*.test.ts"],
    environment: "node",
  },
});
