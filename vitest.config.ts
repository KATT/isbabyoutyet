import { defineConfig } from "vitest/config";
import { webUnitProject } from "./apps/web/vitest.config.ts";

/**
 * Monorepo Vitest projects (formerly "workspaces").
 * Run all packages from the repo root with `pnpm test` / `pnpm exec vitest run`.
 */
export default defineConfig({
  test: {
    projects: ["packages/convex", "packages/query-prefetch", webUnitProject],
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
      ],
      exclude: [
        "**/_generated/**",
        "**/routeTree.gen.ts",
        "**/*.test.{ts,tsx}",
        "**/test.setup.ts",
        "**/test.resource.ts",
      ],
      reporter: ["text-summary", "html", "json", "json-summary"],
      thresholds: {
        // Coverage ratchet: `autoUpdate` rewrites these numbers whenever a
        // test run beats them, so coverage can only go up. Never lower them
        // by hand.
        autoUpdate: true,
        statements: 66.29,
        branches: 60.74,
        functions: 63.48,
        lines: 66.88,
      },
    },
  },
});
