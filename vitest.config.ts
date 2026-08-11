import { defineConfig } from "vitest/config";

/**
 * Monorepo Vitest projects (formerly "workspaces").
 * Run all packages from the repo root with `pnpm test` / `pnpm exec vitest run`.
 */
export default defineConfig({
  test: {
    projects: ["packages/convex", "apps/web"],
  },
});
