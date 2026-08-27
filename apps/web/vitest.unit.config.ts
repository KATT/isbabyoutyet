import { defineConfig } from "vitest/config";
import { createVitestAffectedPlugin } from "../../scripts/createVitestAffectedPlugin.ts";
import { webUnitProject } from "./vitest.config.ts";

/**
 * Single-project unit config so vitest-affected can select tests.
 * Root/apps/web default config still uses projects (unit + browser).
 */
export default defineConfig({
  plugins: [...(webUnitProject.plugins ?? []), createVitestAffectedPlugin()],
  root: webUnitProject.root,
  test: webUnitProject.test,
});
