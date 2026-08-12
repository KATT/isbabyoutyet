/// <reference types="vite/client" />
import type { convexTest } from "convex-test";

/**
 * All Convex function modules for convex-test.
 * Lives under convex/ (Confect codegen target); tests live outside it.
 */
export const modules = import.meta.glob([
  "../convex/**/*.{js,ts}",
  "!../convex/**/*.d.ts",
]);

/**
 * Module glob for the convex-table-history component ("babyAuditLog" in
 * convex.config.ts), used by the trigger-wrapped baby mutations.
 */
export const babyAuditLogModules = import.meta.glob([
  "../node_modules/convex-table-history/src/component/**/*.{js,ts}",
  "!../node_modules/convex-table-history/src/component/**/*.test.ts",
  "!../node_modules/convex-table-history/src/component/**/*.d.ts",
]);

/**
 * Module glob for the Better Auth component — needed by the demo seeder
 * (sign-up + email lookup) and any auth-backed tests.
 */
export const betterAuthModules = import.meta.glob([
  "../node_modules/@convex-dev/better-auth/dist/component/**/*.{js,ts}",
  "!../node_modules/@convex-dev/better-auth/dist/component/**/*.test.ts",
  "!../node_modules/@convex-dev/better-auth/dist/component/**/*.d.ts",
  "!../node_modules/@convex-dev/better-auth/dist/component/testProfiles/**",
]);

type TestConvex = ReturnType<typeof convexTest>;

export async function registerComponents(t: TestConvex) {
  const babyAuditLogSchema =
    (await import("../node_modules/convex-table-history/src/component/schema")) as {
      default: Parameters<TestConvex["registerComponent"]>[1];
    };
  t.registerComponent("babyAuditLog", babyAuditLogSchema.default, babyAuditLogModules);

  const betterAuthSchema =
    (await import("../node_modules/@convex-dev/better-auth/dist/component/schema.js")) as {
      default: Parameters<TestConvex["registerComponent"]>[1];
    };
  t.registerComponent("betterAuth", betterAuthSchema.default, betterAuthModules);
}
