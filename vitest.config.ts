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
      //
      // Scope: unit-testable product code. Framework composition roots
      // (`apps/web/src/routes/**`, router/client bootstrap in `apps/web/src`,
      // auth wiring in `apps/web/src/lib`) are out of scope for unit coverage
      // — they are exercised by the framework and belong to E2E testing.
      include: [
        "apps/web/src/components/**/*.{ts,tsx}",
        "packages/convex/convex/**/*.ts",
        "packages/convex/src/**/*.ts",
      ],
      exclude: [
        "**/_generated/**",
        "**/*.test.{ts,tsx}",
        "**/test.setup.ts",
        "**/test.resource.ts",
        "**/test-helpers.ts",
        // better-auth/Convex wiring — configuration, no unit-testable logic
        "packages/convex/convex/auth.ts",
        "packages/convex/convex/auth.config.ts",
        "packages/convex/convex/http.ts",
        "packages/convex/convex/convex.config.ts",
        // dev/ops scripts, run manually against a deployment
        "packages/convex/convex/seed.ts",
        "packages/convex/convex/migrations.ts",
      ],
      reporter: ["text-summary", "html", "json", "json-summary"],
      thresholds: {
        // Fixed coverage floor: every metric must stay above 90%.
        // (Current actuals: ~97% statements / ~91% branches — see the
        // coverage report. Flip `autoUpdate: true` to turn this back into a
        // self-ratcheting floor that follows the actual coverage upward.)
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
