import { internalMutation } from "./_generated/server";

const PREVIEW_USER_ID = "preview-user";

/**
 * Internal mutation for seeding preview data.
 * Can only be called from other Convex functions.
 */
export const seedPreviewData = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Check if seed data already exists (idempotency check)
    const existingBabies = await ctx.db
      .query("baby")
      .withIndex("by_user", (q) => q.eq("userId", PREVIEW_USER_ID))
      .collect();

    if (existingBabies.length > 0) {
      // Seed data already exists, skip creation
      return {
        success: true,
        message: "Seed data already exists",
        count: existingBabies.length,
      };
    }

    const now = new Date();
    const dueDate1 = new Date(now);
    dueDate1.setDate(dueDate1.getDate() + 7); // Due in 7 days

    const dueDate2 = new Date(now);
    dueDate2.setDate(dueDate2.getDate() + 14); // Due in 14 days
    const laborStarted2 = new Date(now);
    laborStarted2.setHours(laborStarted2.getHours() - 2); // Labor started 2 hours ago

    // Baby 1: "not yet" state (no labor started, no hospital, no birth)
    const baby1Id = await ctx.db.insert("baby", {
      userId: PREVIEW_USER_ID,
      name: "Baby Preview",
      dueDate: dueDate1.toISOString(),
      publicId: "baby-preview",
      hospitalMessage: null,
      babyBornMessage: null,
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
      theme: null,
      encouragementsDisabled: false,
    });

    // Baby 2: "labor started" state (labor started, but not at hospital yet)
    const baby2Id = await ctx.db.insert("baby", {
      userId: PREVIEW_USER_ID,
      name: "Baby In Labor",
      dueDate: dueDate2.toISOString(),
      publicId: "baby-in-labor",
      hospitalMessage: null,
      babyBornMessage: null,
      laborStartedMessage: "It's happening! Bags are packed and we're timing contractions.",
      laborStarted: laborStarted2.toISOString(),
      wentToHospital: null,
      babyBorn: null,
      theme: null,
      encouragementsDisabled: false,
    });

    // Seed encouragements with their timeline rows (the pointer is required).
    // The milestone/message backfill is still exercised on previews via the
    // legacy laborStartedMessage above.
    const seedEncouragements: Array<{
      babyId: typeof baby1Id;
      authorName: string;
      message: string;
      minutesAgo: number;
    }> = [
      {
        babyId: baby1Id,
        authorName: "Grandma",
        message: "We can't wait to meet you, little one!",
        minutesAgo: 60 * 26,
      },
      {
        babyId: baby1Id,
        authorName: "Uncle Bob",
        message: "Any day now! Sending love.",
        minutesAgo: 60 * 3,
      },
      {
        babyId: baby2Id,
        authorName: "Aunt Meg",
        message: "Good luck!! You've got this ❤️",
        minutesAgo: 90,
      },
      {
        babyId: baby2Id,
        authorName: "Grandpa Jim",
        message: "Thinking of you all — keep us posted!",
        minutesAgo: 45,
      },
    ];

    for (const seedEncouragement of seedEncouragements) {
      const createdAt = now.getTime() - seedEncouragement.minutesAgo * 60_000;
      const timelineItemId = await ctx.db.insert("timelineItems", {
        babyId: seedEncouragement.babyId,
        kind: "encouragement",
        postedAt: createdAt,
      });
      await ctx.db.insert("encouragements", {
        babyId: seedEncouragement.babyId,
        authorName: seedEncouragement.authorName,
        message: seedEncouragement.message,
        createdAt,
        timelineItemId,
        visitorId: `preview-visitor-${seedEncouragement.authorName.toLowerCase().replace(/\s+/g, "-")}`,
      });
    }

    return {
      success: true,
      message: "Seed data created successfully",
      babies: [
        { id: baby1Id, name: "Baby Preview", state: "not_yet" },
        { id: baby2Id, name: "Baby In Labor", state: "labor_started" },
      ],
    };
  },
});
