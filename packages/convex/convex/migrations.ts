import { Migrations } from "@convex-dev/migrations";
import { components } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";

export const migrations = new Migrations<DataModel>(components.migrations);

// Runner to execute individual migrations via CLI
export const run = migrations.runner();

// Run all pending migrations - called automatically during deployment
// When adding migrations, import `internal` from "./_generated/api" and add references:
// export const runAll = migrations.runner([internal.migrations.migrationName]);
export const runAll = migrations.runner();

// Example migration (uncomment and modify as needed):
// export const exampleMigration = migrations.define({
//   table: "baby",
//   migrateOne: async (ctx, doc) => {
//     // Return patch object or call ctx.db.patch()
//   },
// });
