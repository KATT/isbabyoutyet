import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { components, internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents, registerMigrationsComponent } from "./test.setup";

test("deployment status waits for every required table migration", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  await registerMigrationsComponent(t);

  expect(await t.query(internal.migrations.deploymentStatus, {})).toEqual({
    isDone: false,
    failed: [],
  });
});

test("Better Auth account issuer migration backfills legacy credential accounts", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);

  await t.mutation(components.betterAuth.adapter.create, {
    input: {
      model: "account",
      data: {
        accountId: "legacy-user",
        providerId: "credential",
        userId: "legacy-user",
        password: "legacy-hash",
        createdAt: 1,
        updatedAt: 1,
      },
    },
  });

  await t.mutation(internal.migrations.backfillBetterAuthAccountIssuers, {
    cursor: null,
  });

  const account = await t.query(components.betterAuth.adapter.findOne, {
    model: "account",
    where: [{ field: "accountId", value: "legacy-user" }],
  });
  expect(account).toMatchObject({ issuer: "local:credential" });
});
