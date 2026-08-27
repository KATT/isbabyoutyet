import { defineConfig } from "vitest/config";
import { webUnitProject } from "./apps/web/vitest.config.ts";

/**
 * Monorepo Vitest projects (formerly "workspaces").
 * Run all packages from the repo root with `pnpm test` / `pnpm exec vitest run`.
 */
const oxlintPluginsProject = {
  test: {
    name: "oxlint-plugins",
    include: ["oxlint-plugins/**/*.test.ts"],
    environment: "node" as const,
  },
};

export default defineConfig({
  test: {
    projects: [
      "packages/convex",
      "packages/query-prefetch",
      "packages/convex-prefetch",
      webUnitProject,
      oxlintPluginsProject,
    ],
    experimental: {
      fsModuleCache: true,
      fsModuleCachePath: "node_modules/.experimental-vitest-cache",
    },
    coverage: {
      provider: "v8",
      // In Vitest 4, listing patterns in `include` also pulls *untested*
      // files into the report, so uncovered code counts against the numbers
      // instead of silently hiding.
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        "packages/convex/convex/**/*.ts",
        "packages/convex/src/**/*.ts",
        "packages/query-prefetch/src/**/*.ts",
        "packages/convex-prefetch/src/**/*.ts",
      ],
      exclude: [
        "**/_generated/**",
        "**/routeTree.gen.ts",
        "**/*.test.{ts,tsx}",
        "**/test.setup.ts",
        "**/test.resource.ts",
      ],
      // CI: json-summary for the local coverage ratchet; lcov for Codecov history uploads.
      // Local: full HTML/JSON reports for browsing.
      reporter: process.env.CI
        ? ["text-summary", "json-summary", "lcov"]
        : ["text-summary", "html", "json", "json-summary"],
    },
  },
});
