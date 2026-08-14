/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

test("baby and related writes leave a durable targeted purge job", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });
  await asAlice.mutation(api.baby.update, {
    babyId: created.babyId,
    name: "Baby Jones",
  });
  await t.mutation(api.encouragements.create, {
    babyId: created.babyId,
    authorName: "Grandma",
    message: "We cannot wait!",
    visitorId: "visitor-1",
  });

  const jobs = await t.run(async (ctx) => {
    return await ctx.db.query("cacheInvalidationJobs").collect();
  });

  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    key: `baby:${created.babyId}`,
    attempts: 0,
  });
  expect(jobs[0]?.tags).toEqual(
    expect.arrayContaining([
      `baby-id:${created.babyId}`,
      "baby-public-id:baby-jones",
    ]),
  );
  expect(jobs[0]?.version).toBeGreaterThanOrEqual(1);
});

test("profile locale changes purge every baby page without reading an unbounded baby list", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });

  await asAlice.mutation(api.profile.ensure, { browserLocale: "en-GB" });
  await asAlice.mutation(api.profile.updateLocale, { locale: "sv" });

  const jobs = await t.run(async (ctx) => {
    return await ctx.db.query("cacheInvalidationJobs").collect();
  });

  expect(jobs).toHaveLength(1);
  expect(jobs[0]).toMatchObject({
    key: "all-baby-pages",
    tags: ["baby-pages"],
    version: 2,
  });
});
