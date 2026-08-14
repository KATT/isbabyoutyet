import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerMigrationsComponent } from "./test.setup";

test("deployment status waits for every required table migration", async () => {
  const t = convexTest(schema, modules);
  await registerMigrationsComponent(t);

  expect(await t.query(internal.migrations.deploymentStatus, {})).toEqual({
    isDone: false,
    failed: [],
  });
});
