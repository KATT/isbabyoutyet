import { internalMutation, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";

const PREVIEW_USER_ID = "preview-user";

/**
 * Shared seed logic for creating preview test data.
 */
async function seedPreviewDataLogic(ctx: MutationCtx) {
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
    laborStarted: laborStarted2.toISOString(),
    wentToHospital: null,
    babyBorn: null,
    theme: null,
    encouragementsDisabled: false,
  });

  return {
    success: true,
    message: "Seed data created successfully",
    babies: [
      { id: baby1Id, name: "Baby Preview", state: "not_yet" },
      { id: baby2Id, name: "Baby In Labor", state: "labor_started" },
    ],
  };
}

/**
 * Internal mutation for seeding preview data.
 * Can only be called from other Convex functions.
 */
export const seedPreviewData = internalMutation({
  args: {},
  handler: async (ctx) => {
    return await seedPreviewDataLogic(ctx);
  },
});

/**
 * Public mutation wrapper for seeding preview data.
 * Can be called from CLI during deployment.
 * This is safe because it only creates data with preview-user userId.
 */
export const seedPreviewDataPublic = mutation({
  args: {},
  handler: async (ctx) => {
    return await seedPreviewDataLogic(ctx);
  },
});

