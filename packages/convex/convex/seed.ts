import { components } from "./_generated/api";
import { internalMutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { createAuth } from "./auth";
import { DEMO_BABIES, DEMO_USER } from "../src/seedCredentials";
import { insertEncouragementTimelineItem, insertUpdateWithTimelineItem } from "./timeline";
import type { Milestone } from "../src/types";

async function seedDemoDataHandler(ctx: MutationCtx) {
  const userId = await ensureDemoUser(ctx);

  const existingBabies = await ctx.db
    .query("baby")
    .withIndex("by_user", (q) => q.eq("userId", userId))
    .collect();

  if (existingBabies.length > 0) {
    return {
      success: true,
      message: "Seed data already exists",
      userId,
      email: DEMO_USER.email,
      count: existingBabies.length,
    };
  }

  const babies = await seedBabiesForUser(ctx, userId);

  return {
    success: true,
    message: "Seed data created successfully",
    userId,
    email: DEMO_USER.email,
    babies,
  };
}

/**
 * Idempotent seeder for local development and Vercel preview deployments.
 * Creates DEMO_USER (test@example.com / password) and babies in every status.
 *
 * Preview deploys run this via `--preview-run`; local setup runs `pnpm seed`.
 */
export const seedDemoData = internalMutation({
  args: {},
  handler: seedDemoDataHandler,
});

/** Alias kept so older `--preview-run seed:seedPreviewData` refs keep working. */
export const seedPreviewData = internalMutation({
  args: {},
  handler: seedDemoDataHandler,
});

async function ensureDemoUser(ctx: MutationCtx) {
  const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: "user",
    where: [{ field: "email", value: DEMO_USER.email }],
  });

  if (existing) {
    return String(existing._id);
  }

  const auth = createAuth(ctx);
  const result = await auth.api.signUpEmail({
    body: {
      email: DEMO_USER.email,
      password: DEMO_USER.password,
      name: DEMO_USER.name,
    },
  });

  return result.user.id;
}

type SeedBabyExtras = {
  dueDateOffsetDays: number;
  laborStartedMessage?: string;
  hospitalMessage?: string;
  babyBornMessage?: string;
  hoursAgo?: {
    laborStarted?: number;
    wentToHospital?: number;
    babyBorn?: number;
  };
  encouragements?: Array<{
    authorName: string;
    message: string;
    minutesAgo: number;
  }>;
};

type SeedBabySpec = (typeof DEMO_BABIES)[number] & SeedBabyExtras;

/** Fixture details keyed by publicId — identity fields come from DEMO_BABIES. */
const SEED_BABY_EXTRAS: Record<(typeof DEMO_BABIES)[number]["publicId"], SeedBabyExtras> = {
  "baby-waiting": {
    dueDateOffsetDays: 14,
    encouragements: [
      {
        authorName: "Grandma",
        message: "We can't wait to meet you, little one!",
        minutesAgo: 60 * 26,
      },
      {
        authorName: "Uncle Bob",
        message: "Any day now! Sending love.",
        minutesAgo: 60 * 3,
      },
    ],
  },
  "baby-in-labor": {
    dueDateOffsetDays: 3,
    laborStartedMessage: "It's happening! Bags are packed and we're timing contractions.",
    hoursAgo: { laborStarted: 2 },
    encouragements: [
      {
        authorName: "Aunt Meg",
        message: "Good luck!! You've got this ❤️",
        minutesAgo: 90,
      },
      {
        authorName: "Grandpa Jim",
        message: "Thinking of you all — keep us posted!",
        minutesAgo: 45,
      },
    ],
  },
  "baby-at-hospital": {
    dueDateOffsetDays: 1,
    laborStartedMessage: "Contractions got serious — heading in!",
    hospitalMessage: "Checked in and settling into the delivery room.",
    hoursAgo: { laborStarted: 8, wentToHospital: 3 },
    encouragements: [
      {
        authorName: "Sister Sam",
        message: "So exciting!! Love you both.",
        minutesAgo: 60,
      },
    ],
  },
  "baby-born": {
    dueDateOffsetDays: -2,
    laborStartedMessage: "Here we go!",
    hospitalMessage: "At the hospital and ready.",
    babyBornMessage: "Welcome to the world — everyone is healthy and happy!",
    hoursAgo: { laborStarted: 30, wentToHospital: 24, babyBorn: 12 },
    encouragements: [
      {
        authorName: "Cousin Pat",
        message: "Congratulations!!! Can't wait to visit.",
        minutesAgo: 60 * 6,
      },
      {
        authorName: "Neighbor Jo",
        message: "What wonderful news. Rest up!",
        minutesAgo: 60 * 2,
      },
    ],
  },
};

const SEED_BABIES: SeedBabySpec[] = DEMO_BABIES.map((baby) => ({
  ...baby,
  ...SEED_BABY_EXTRAS[baby.publicId],
}));

/**
 * Inserts the demo babies (and their timeline/encouragement fixtures) for a user.
 * Exported for tests that supply their own userId without Better Auth.
 */
export async function seedBabiesForUser(ctx: MutationCtx, userId: string) {
  const now = new Date();
  const created: Array<{
    id: Id<"baby">;
    name: string;
    state: SeedBabySpec["state"];
    publicId: string;
  }> = [];

  for (const spec of SEED_BABIES) {
    const dueDate = new Date(now);
    dueDate.setDate(dueDate.getDate() + spec.dueDateOffsetDays);

    const laborStarted = hoursAgoIso(now, spec.hoursAgo?.laborStarted);
    const wentToHospital = hoursAgoIso(now, spec.hoursAgo?.wentToHospital);
    const babyBorn = hoursAgoIso(now, spec.hoursAgo?.babyBorn);

    const babyId = await ctx.db.insert("baby", {
      userId,
      name: spec.name,
      dueDate: dueDate.toISOString(),
      publicId: spec.publicId,
      laborStartedMessage: spec.laborStartedMessage ?? null,
      hospitalMessage: spec.hospitalMessage ?? null,
      babyBornMessage: spec.babyBornMessage ?? null,
      laborStarted,
      wentToHospital,
      babyBorn,
      theme: null,
      encouragementsDisabled: false,
    });

    await seedMilestoneUpdates(ctx, {
      babyId,
      laborStarted,
      wentToHospital,
      babyBorn,
      laborStartedMessage: spec.laborStartedMessage ?? null,
      hospitalMessage: spec.hospitalMessage ?? null,
      babyBornMessage: spec.babyBornMessage ?? null,
    });

    for (const encouragement of spec.encouragements ?? []) {
      const createdAt = now.getTime() - encouragement.minutesAgo * 60_000;
      const timelineItemId = await insertEncouragementTimelineItem(ctx, {
        babyId,
        postedAt: createdAt,
      });
      await ctx.db.insert("encouragements", {
        babyId,
        authorName: encouragement.authorName,
        message: encouragement.message,
        createdAt,
        timelineItemId,
        visitorId: `seed-visitor-${encouragement.authorName.toLowerCase().replace(/\s+/g, "-")}`,
      });
    }

    created.push({
      id: babyId,
      name: spec.name,
      state: spec.state,
      publicId: spec.publicId,
    });
  }

  return created;
}

function hoursAgoIso(now: Date, hoursAgo: number | undefined) {
  if (hoursAgo === undefined) return null;
  const date = new Date(now);
  date.setHours(date.getHours() - hoursAgo);
  return date.toISOString();
}

async function seedMilestoneUpdates(
  ctx: MutationCtx,
  opts: {
    babyId: Id<"baby">;
    laborStarted: string | null;
    wentToHospital: string | null;
    babyBorn: string | null;
    laborStartedMessage: string | null;
    hospitalMessage: string | null;
    babyBornMessage: string | null;
  },
) {
  const milestones: Array<{
    milestone: Milestone;
    iso: string | null;
    message: string | null;
  }> = [
    {
      milestone: "labor_started",
      iso: opts.laborStarted,
      message: opts.laborStartedMessage,
    },
    {
      milestone: "gone_to_hospital",
      iso: opts.wentToHospital,
      message: opts.hospitalMessage,
    },
    {
      milestone: "born",
      iso: opts.babyBorn,
      message: opts.babyBornMessage,
    },
  ];

  for (const entry of milestones) {
    if (!entry.iso) continue;
    const occurredAt = Date.parse(entry.iso);
    await insertUpdateWithTimelineItem(ctx, {
      babyId: opts.babyId,
      postedAt: occurredAt,
      occurredAt,
      milestone: entry.milestone,
      message: entry.message,
    });
  }
}
