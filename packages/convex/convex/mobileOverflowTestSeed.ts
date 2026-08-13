import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { insertEncouragementTimelineItem, insertUpdateWithTimelineItem } from "./timeline";

const FIXTURE_OWNER = "mobile-overflow-browser-test";
const STATUS_PUBLIC_ID = "mobile-overflow-status-test";
const CONTENT_PUBLIC_ID = "mobile-overflow-content-test";
const CLEAR_BATCH_SIZE = 32;

const STRESS_ENCOURAGEMENTS = [
  {
    authorName: "NoSpacesAuthorNameAtMaximumLength123456789012345",
    message: "W".repeat(240),
  },
  {
    authorName: "Link Tester",
    message: `A deliberately long link: https://overflow-fixture.test/${"deep-path/".repeat(30)}`,
  },
  {
    authorName: "Emoji Parade",
    message: `Welcome, baby! ${"👶🏽🎉🍼".repeat(30)}`,
  },
  {
    authorName: "Excited Cousins",
    message: `**${"WELCOME".repeat(40)}**`,
  },
  {
    authorName: "Code Block Friend",
    message: `\`${"CONGRATULATIONS".repeat(24)}\``,
  },
  {
    authorName: "Very Online Aunt",
    message: `#baby #welcome #soexcited ${"#cantwaittomeetyou".repeat(20)}`,
  },
  {
    authorName: "Multilingual Family",
    message: "Välkommen—Bienvenida—Bem-vinda—Welcome—".repeat(16),
  },
  {
    authorName: "Caps Lock Grandpa",
    message: "THIS IS THE BEST NEWS EVER!!! ".repeat(20),
  },
] as const;

const FIXTURES = [
  {
    name: "Status Layout Probe",
    publicId: STATUS_PUBLIC_ID,
    includeStressFeed: false,
  },
  {
    name: "Content Layout Probe",
    publicId: CONTENT_PUBLIC_ID,
    includeStressFeed: true,
  },
] as const;

async function deleteTimelineItem(ctx: MutationCtx, item: Doc<"timelineItems">) {
  switch (item.kind) {
    case "update": {
      const update = await ctx.db
        .query("updates")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .unique();
      if (update) await ctx.db.delete(update._id);
      break;
    }
    case "encouragement": {
      const encouragement = await ctx.db
        .query("encouragements")
        .withIndex("by_timelineItemId", (q) => q.eq("timelineItemId", item._id))
        .unique();
      if (encouragement) await ctx.db.delete(encouragement._id);
      break;
    }
  }
  await ctx.db.delete(item._id);
}

async function clearFixtureFeed(ctx: MutationCtx, babyId: Id<"baby">) {
  for (;;) {
    const items = await ctx.db
      .query("timelineItems")
      .withIndex("by_babyId_postedAt", (q) => q.eq("babyId", babyId))
      .take(CLEAR_BATCH_SIZE);
    for (const item of items) {
      await deleteTimelineItem(ctx, item);
    }
    if (items.length < CLEAR_BATCH_SIZE) return;
  }
}

async function ensureFixtureBaby(
  ctx: MutationCtx,
  options: {
    spec: (typeof FIXTURES)[number];
    now: number;
  },
) {
  const existing = await ctx.db
    .query("baby")
    .withIndex("by_publicId", (q) => q.eq("publicId", options.spec.publicId))
    .unique();
  if (existing && (existing.userId !== FIXTURE_OWNER || existing.demo !== true)) {
    throw new Error(`Refusing to overwrite non-test baby "${options.spec.publicId}"`);
  }

  const laborStarted = new Date(options.now - 30 * 60 * 60_000).toISOString();
  const wentToHospital = new Date(options.now - 21 * 60 * 60_000).toISOString();
  const babyBorn = new Date(options.now - 4 * 60 * 60_000).toISOString();
  const fields = {
    userId: FIXTURE_OWNER,
    name: options.spec.name,
    publicId: options.spec.publicId,
    dueDate: new Date(options.now - 2 * 24 * 60 * 60_000).toISOString(),
    laborStarted,
    wentToHospital,
    babyBorn,
    laborStartedMessage: null,
    hospitalMessage: null,
    babyBornMessage: null,
    theme: "sunny-days",
    locale: "en-US" as const,
    encouragementsDisabled: false,
    photoId: null,
    thumbnailId: null,
    demo: true,
  };

  if (existing) {
    await clearFixtureFeed(ctx, existing._id);
    await ctx.db.patch(existing._id, fields);
    if (existing.photoId) await ctx.storage.delete(existing.photoId);
    return existing._id;
  }
  return await ctx.db.insert("baby", fields);
}

async function insertFixtureFeed(
  ctx: MutationCtx,
  options: {
    spec: (typeof FIXTURES)[number];
    babyId: Id<"baby">;
    now: number;
  },
) {
  const laborStartedAt = options.now - 30 * 60 * 60_000;
  const wentToHospitalAt = options.now - 21 * 60 * 60_000;
  const bornAt = options.now - 4 * 60 * 60_000;
  await insertUpdateWithTimelineItem(ctx, {
    babyId: options.babyId,
    postedAt: laborStartedAt,
    occurredAt: laborStartedAt,
    milestone: "labor_started",
    message: "Contractions started and we're taking it one wave at a time.",
  });
  await insertUpdateWithTimelineItem(ctx, {
    babyId: options.babyId,
    postedAt: wentToHospitalAt,
    occurredAt: wentToHospitalAt,
    milestone: "gone_to_hospital",
    message: "Checked in at the hospital. Everyone here has been wonderful.",
  });
  await insertUpdateWithTimelineItem(ctx, {
    babyId: options.babyId,
    postedAt: bornAt,
    occurredAt: bornAt,
    milestone: "born",
    message:
      "She's here! Our layout probe arrived after a long beautiful labor. Thank you for following along with us.",
  });

  if (!options.spec.includeStressFeed) {
    const createdAt = options.now - 60 * 60_000;
    const timelineItemId = await insertEncouragementTimelineItem(ctx, {
      babyId: options.babyId,
      postedAt: createdAt,
    });
    await ctx.db.insert("encouragements", {
      babyId: options.babyId,
      authorName: "Grandma Linda",
      message: "Welcome to the world. What wonderful news for the whole family!",
      createdAt,
      timelineItemId,
      visitorId: "mobile-overflow-browser-test-status",
    });
    return;
  }
  for (const [index, encouragement] of STRESS_ENCOURAGEMENTS.entries()) {
    const createdAt = options.now - (index + 1) * 10 * 60_000;
    const timelineItemId = await insertEncouragementTimelineItem(ctx, {
      babyId: options.babyId,
      postedAt: createdAt,
    });
    await ctx.db.insert("encouragements", {
      babyId: options.babyId,
      authorName: encouragement.authorName,
      message: encouragement.message,
      createdAt,
      timelineItemId,
      visitorId: `mobile-overflow-browser-test-${index}`,
    });
  }
}

export const seed = internalMutation({
  args: {},
  returns: v.object({ publicIds: v.array(v.string()) }),
  handler: async (ctx) => {
    const now = Date.now();
    const publicIds: string[] = [];
    for (const spec of FIXTURES) {
      const fixture = await ensureFixtureBaby(ctx, {
        spec,
        now,
      });
      await insertFixtureFeed(ctx, {
        spec,
        babyId: fixture,
        now,
      });
      publicIds.push(spec.publicId);
    }
    return { publicIds };
  },
});
