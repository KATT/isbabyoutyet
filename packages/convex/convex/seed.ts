import { internalAction, internalMutation } from "./_generated/server";
import { components, internal } from "./_generated/api";
import { createAuth } from "./auth";

const PREVIEW_USER_ID = "preview-user";

/** Matches the default credentials on the local login/signup forms. */
export const LOCAL_TEST_USER = {
  email: "test@example.com",
  password: "password",
  name: "Test User",
} as const;

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
  },
});

/**
 * Seed sample babies for the local test user. Idempotent.
 */
export const seedLocalDevBabies = internalMutation({
  args: {},
  handler: async (ctx) => {
    const user = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: "user",
      where: [{ field: "email", value: LOCAL_TEST_USER.email }],
    });
    if (!user) {
      throw new Error(
        `Local test user ${LOCAL_TEST_USER.email} not found — run seed:seedLocalDev first`,
      );
    }

    const userId = user._id;
    const existingBabies = await ctx.db
      .query("baby")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    if (existingBabies.length > 0) {
      return {
        success: true,
        message: "Local seed data already exists",
        userId,
        count: existingBabies.length,
      };
    }

    const now = new Date();
    const dueDate1 = new Date(now);
    dueDate1.setDate(dueDate1.getDate() + 7);

    const dueDate2 = new Date(now);
    dueDate2.setDate(dueDate2.getDate() + 14);
    const laborStarted2 = new Date(now);
    laborStarted2.setHours(laborStarted2.getHours() - 2);

    const baby1Id = await ctx.db.insert("baby", {
      userId,
      name: "Baby Smith",
      dueDate: dueDate1.toISOString().slice(0, 10),
      publicId: "baby-smith",
      hospitalMessage: null,
      babyBornMessage: null,
      laborStarted: null,
      wentToHospital: null,
      babyBorn: null,
      theme: null,
      encouragementsDisabled: false,
    });

    const baby2Id = await ctx.db.insert("baby", {
      userId,
      name: "Baby In Labor",
      dueDate: dueDate2.toISOString().slice(0, 10),
      publicId: "baby-in-labor-local",
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
      message: "Local seed data created",
      userId,
      babies: [
        { id: baby1Id, name: "Baby Smith", state: "not_yet" },
        { id: baby2Id, name: "Baby In Labor", state: "labor_started" },
      ],
    };
  },
});

/**
 * Full local seed: Better Auth test user + sample babies. Safe to re-run.
 * Invoked from scripts/setup-dev-env.mjs via `convex run`.
 */
export const seedLocalDev = internalAction({
  args: {},
  handler: async (ctx) => {
    const auth = createAuth(ctx);
    let created = true;
    try {
      await auth.api.signUpEmail({
        body: {
          email: LOCAL_TEST_USER.email,
          password: LOCAL_TEST_USER.password,
          name: LOCAL_TEST_USER.name,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!/already exists/i.test(message)) {
        throw error;
      }
      created = false;
    }

    // Annotate to break TS circularity when calling a sibling in this file
    const babies: {
      success: boolean;
      message: string;
      userId: string;
      count?: number;
      babies?: { id: string; name: string; state: string }[];
    } = await ctx.runMutation(internal.seed.seedLocalDevBabies, {});

    return {
      user: { created, email: LOCAL_TEST_USER.email },
      babies,
    };
  },
});
