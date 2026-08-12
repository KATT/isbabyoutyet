import { componentsGeneric } from "convex/server";

export type Components = {
  babyAuditLog: import("convex-table-history/_generated/component.js").ComponentApi<"babyAuditLog">;
  betterAuth: import("@convex-dev/better-auth/_generated/component.js").ComponentApi<"betterAuth">;
  migrations: import("@convex-dev/migrations/_generated/component.js").ComponentApi<"migrations">;
};

export const components: Components = componentsGeneric() as any;
