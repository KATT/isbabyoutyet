import { convexTest } from "convex-test";
import { expect, test } from "vitest";
import { api } from "./_generated/api";
import {
  backfillHistoricalPhotosFromAuditLogDoc,
  planPhotoTimelineInjectionsForBaby,
  resolveBabyByPublicIdOrSlug,
} from "./photoTimelineBackfill";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

const FIRST_PAGE = { numItems: 20, cursor: null };

async function setup() {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby Smith",
    dueDate: "2026-09-01",
  });
  return { t, asAlice, babyId: created.babyId };
}

async function storeBlob(t: Awaited<ReturnType<typeof setup>>["t"]) {
  return await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob(["photo"], { type: "image/jpeg" }));
  });
}

test("audit-log photo backfill injects replaced photos at upload time", async () => {
  const { t, asAlice, babyId } = await setup();

  const photoA = await storeBlob(t);
  const photoB = await storeBlob(t);

  await asAlice.mutation(api.baby.updatePhoto, { babyId, photoId: photoA });
  await asAlice.mutation(api.baby.updatePhoto, { babyId, photoId: photoB });

  // Simulate pre-timeline state: milestone rows exist but only the latest
  // photo was dual-written to the feed.
  await t.run(async (ctx) => {
    const updates = await ctx.db
      .query("updates")
      .withIndex("by_babyId", (q) => q.eq("babyId", babyId))
      .collect();
    for (const update of updates) {
      if (update.photoId === photoA) {
        const timelineItem = await ctx.db.get(update.timelineItemId);
        if (timelineItem) await ctx.db.delete(timelineItem._id);
        await ctx.db.delete(update._id);
      }
    }
  });

  await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    await backfillHistoricalPhotosFromAuditLogDoc(ctx, baby);
  });

  const plans = await t.run(async (ctx) => {
    const baby = await ctx.db.get(babyId);
    if (!baby) throw new Error("Baby not found");
    return await planPhotoTimelineInjectionsForBaby(ctx, baby);
  });
  expect(plans).toHaveLength(2);
  expect(plans.every((plan) => plan.storageExists)).toBe(true);

  const feed = await t.query(api.timeline.listByBaby, { babyId, paginationOpts: FIRST_PAGE });
  const photoUrls = feed.page
    .filter((item) => item.kind === "update" && item.update.photoUrl)
    .map((item) => item.kind === "update" && item.update.photoUrl);
  expect(photoUrls).toHaveLength(2);
  expect(photoUrls.every(Boolean)).toBe(true);
});

test("preview resolves legacy publicId slugs like alma", async () => {
  const { t, babyId } = await setup();
  await t.run(async (ctx) => {
    await ctx.db.insert("babyPublicIdHistory", {
      babyId,
      publicId: "alma",
    });
  });

  const resolved = await t.run(async (ctx) => resolveBabyByPublicIdOrSlug(ctx, "alma"));
  expect(resolved?._id).toBe(babyId);
});
