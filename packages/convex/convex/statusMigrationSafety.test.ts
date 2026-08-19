import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import schema from "./schema";
import { modules, registerComponents, registerMigrationsComponent } from "./test.setup";
import { insertUpdateWithTimelineItem } from "./timeline";
import type { Milestone } from "../src/types";

const FIRST_PAGE = { numItems: 50, cursor: null };
const RETIRED_FIELDS = [
  "laborStarted",
  "wentToHospital",
  "babyBorn",
  "laborStartedMessage",
  "hospitalMessage",
  "babyBornMessage",
] as const;

const MILESTONES = [
  {
    milestone: "labor_started",
    dateField: "laborStarted",
    messageField: "laborStartedMessage",
    date: "2026-08-10T08:00:00.000Z",
    message: "It has begun!",
  },
  {
    milestone: "gone_to_hospital",
    dateField: "wentToHospital",
    messageField: "hospitalMessage",
    date: "2026-08-10T12:00:00.000Z",
    message: "Checked in safely.",
  },
  {
    milestone: "born",
    dateField: "babyBorn",
    messageField: "babyBornMessage",
    date: "2026-08-11T03:00:00.000Z",
    message: "Baby is here!",
  },
] as const satisfies ReadonlyArray<{
  milestone: Milestone;
  dateField: "laborStarted" | "wentToHospital" | "babyBorn";
  messageField: "laborStartedMessage" | "hospitalMessage" | "babyBornMessage";
  date: string;
  message: string;
}>;

test("cleanup preserves public baby, timeline, and dashboard requests", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  await registerMigrationsComponent(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const babies: Array<{ babyId: Id<"baby">; publicId: string }> = [];

  for (let reached = 0; reached <= MILESTONES.length; reached += 1) {
    const created = await asAlice.mutation(api.baby.create, {
      name: `Migration Safety ${reached}`,
      dueDate: "2026-09-01",
      birthJourney: "labor",
    });
    babies.push(created);

    await t.run(async (ctx) => {
      const legacyPatch = {
        laborStarted: null as string | null,
        wentToHospital: null as string | null,
        babyBorn: null as string | null,
        laborStartedMessage: null as string | null,
        hospitalMessage: null as string | null,
        babyBornMessage: null as string | null,
      };

      for (const milestone of MILESTONES.slice(0, reached)) {
        legacyPatch[milestone.dateField] = milestone.date;
        legacyPatch[milestone.messageField] = milestone.message;
        await insertUpdateWithTimelineItem(ctx, {
          babyId: created.babyId,
          postedAt: Date.parse(milestone.date) + 60_000,
          occurredAt: Date.parse(milestone.date),
          milestone: milestone.milestone,
          message: milestone.message,
          postedByUserId: "alice",
        });
      }

      await ctx.db.patch(created.babyId, legacyPatch);
    });
  }

  const publicBefore = await Promise.all(
    babies.map(async (baby) => await t.query(api.baby.getByPublicId, { id: baby.publicId })),
  );
  const feedsBefore = await Promise.all(
    babies.map(
      async (baby) =>
        await t.query(api.timeline.listByBaby, {
          babyId: baby.babyId,
          paginationOpts: FIRST_PAGE,
        }),
    ),
  );
  const dashboardBefore = await asAlice.query(api.baby.listByUser, {});

  const migration = await t.mutation(internal.migrations.runStoredStatusCleanup, {
    oneBatchOnly: true,
  });
  expect(migration).toBeTruthy();

  const publicAfter = await Promise.all(
    babies.map(async (baby) => await t.query(api.baby.getByPublicId, { id: baby.publicId })),
  );
  const feedsAfter = await Promise.all(
    babies.map(
      async (baby) =>
        await t.query(api.timeline.listByBaby, {
          babyId: baby.babyId,
          paginationOpts: FIRST_PAGE,
        }),
    ),
  );
  const dashboardAfter = await asAlice.query(api.baby.listByUser, {});

  expect(publicAfter).toEqual(publicBefore);
  expect(feedsAfter).toEqual(feedsBefore);
  expect(dashboardAfter).toEqual(dashboardBefore);

  await t.run(async (ctx) => {
    for (const baby of babies) {
      const stored = await ctx.db.get(baby.babyId);
      expect(stored).not.toBeNull();
      for (const field of RETIRED_FIELDS) {
        expect(stored).not.toHaveProperty(field);
      }
    }
  });
});
