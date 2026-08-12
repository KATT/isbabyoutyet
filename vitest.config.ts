import { defineConfig } from "vitest/config";

/**
 * Monorepo Vitest projects (formerly "workspaces").
 * Run all packages from the repo root with `pnpm test` / `pnpm exec vitest run`.
 */
export default defineConfig({
  test: {
    projects: ["packages/convex", "apps/web"],
    coverage: {
      provider: "v8",
      // In Vitest 4, listing patterns in `include` also pulls *untested*
      // files into the report, so uncovered code counts against the numbers
      // instead of silently hiding.
      include: [
        "apps/web/src/**/*.{ts,tsx}",
        // Authoring tree (Effect/Confect). Generated convex/ re-exports are excluded.
        "packages/convex/confect/**/*.ts",
        "packages/convex/src/**/*.ts",
      ],
      exclude: [
        "**/_generated/**",
        "**/routeTree.gen.ts",
        "**/*.test.{ts,tsx}",
        "**/test.setup.ts",
        "**/test.resource.ts",
        // Specs are Effect Schema declarations, not runtime logic under test.
        "packages/convex/confect/**/*.spec.ts",
        "packages/convex/confect/tables/**",
      ],
      reporter: ["text-summary", "html", "json", "json-summary"],
      thresholds: {
        // Coverage ratchet: `autoUpdate` rewrites these numbers whenever a
        // test run beats them, so coverage can only go up. Never lower them
        // by hand. Reset once after the confect/ move so the ratchet tracks
        // the new authoring surface; subsequent runs may only raise these.
        autoUpdate: true,
        statements: 36.8,
        branches: 29.85,
        functions: 28.53,
        lines: 37.5,
      },
    },
  },
});
