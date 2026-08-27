/// <reference types="vite/client" />
import type { FunctionArgs } from "convex/server";
import type { convexTest } from "convex-test";
import type { api } from "./_generated/api";
import type { Doc, TableNames } from "./_generated/dataModel";

/**
 * All Convex function modules for convex-test.
 * Matches files with a single extension ending in `s` (ts/js), which
 * excludes *.test.ts and *.d.ts files.
 */
export const modules = import.meta.glob([
  "./**/*.{js,ts}",
  "!./**/*.test.ts",
  "!./**/*.d.ts",
  "!./test.setup.ts",
]);

/**
 * Module glob for the convex-table-history component ("babyAuditLog" in
 * convex.config.ts), used by the trigger-wrapped baby mutations.
 */
export const babyAuditLogModules = import.meta.glob([
  "../node_modules/convex-table-history/src/component/**/*.{js,ts}",
  "!../node_modules/convex-table-history/src/component/**/*.test.ts",
  "!../node_modules/convex-table-history/src/component/**/*.d.ts",
]);

/**
 * Module glob for the Better Auth component — needed by the demo seeder
 * (sign-up + email lookup) and any auth-backed tests.
 */
export const betterAuthModules = import.meta.glob([
  "../node_modules/@convex-dev/better-auth/dist/component/**/*.{js,ts}",
  "!../node_modules/@convex-dev/better-auth/dist/component/**/*.test.ts",
  "!../node_modules/@convex-dev/better-auth/dist/component/**/*.d.ts",
  "!../node_modules/@convex-dev/better-auth/dist/component/testProfiles/**",
]);

export const migrationsModules = import.meta.glob([
  "../node_modules/@convex-dev/migrations/dist/component/**/*.{js,ts}",
  "!../node_modules/@convex-dev/migrations/dist/component/**/*.test.ts",
  "!../node_modules/@convex-dev/migrations/dist/component/**/*.d.ts",
]);

type TestConvex = ReturnType<typeof convexTest>;

export async function registerComponents(t: TestConvex) {
  const babyAuditLogSchema =
    (await import("../node_modules/convex-table-history/src/component/schema")) as {
      default: Parameters<TestConvex["registerComponent"]>[1];
    };
  t.registerComponent("babyAuditLog", babyAuditLogSchema.default, babyAuditLogModules);

  const betterAuthSchema =
    (await import("../node_modules/@convex-dev/better-auth/dist/component/schema.js")) as {
      default: Parameters<TestConvex["registerComponent"]>[1];
    };
  t.registerComponent("betterAuth", betterAuthSchema.default, betterAuthModules);
}

export async function registerMigrationsComponent(t: TestConvex) {
  const migrationsSchema =
    (await import("../node_modules/@convex-dev/migrations/dist/component/schema.js")) as {
      default: Parameters<TestConvex["registerComponent"]>[1];
    };
  t.registerComponent("migrations", migrationsSchema.default, migrationsModules);
}

/** Required `baby.create` args with the pre-feature defaults tests used to omit. */
export function createBabyArgs(
  opts: Pick<FunctionArgs<typeof api.baby.create>, "name" | "dueDate"> &
    Partial<FunctionArgs<typeof api.baby.create>>,
): FunctionArgs<typeof api.baby.create> {
  return {
    dueDateDisplayMode: opts.dueDate ? "exact" : "message",
    publicDueDateText: null,
    birthJourney: "labor",
    theme: null,
    ...opts,
  };
}

/** Required `updates.post` args; omitted fields are explicit `null`. */
export function postUpdateArgs(
  opts: Pick<FunctionArgs<typeof api.updates.post>, "babyId"> &
    Partial<FunctionArgs<typeof api.updates.post>>,
): FunctionArgs<typeof api.updates.post> {
  return {
    message: null,
    milestone: null,
    occurredAt: null,
    photoId: null,
    ...opts,
  };
}

/** Required `encouragements.create` metadata; omitted fields are explicit `null`. */
export function createEncouragementArgs(
  opts: Pick<
    FunctionArgs<typeof api.encouragements.create>,
    "babyId" | "authorName" | "message" | "visitorId"
  > &
    Partial<FunctionArgs<typeof api.encouragements.create>>,
): FunctionArgs<typeof api.encouragements.create> {
  return {
    userAgent: null,
    locale: null,
    timezone: null,
    ...opts,
  };
}

type InsertDoc<TTable extends TableNames> = Omit<Doc<TTable>, "_id" | "_creationTime">;

/** Complete `baby` insert for tests after schema keys became required. */
export function testBabyInsert(
  opts: Pick<InsertDoc<"baby">, "userId" | "name" | "dueDate" | "publicId"> &
    Partial<InsertDoc<"baby">>,
): InsertDoc<"baby"> {
  return {
    ownerTokenIdentifier: `https://convex.test|${opts.userId}`,
    dueDateDisplayMode: opts.dueDate ? "exact" : "message",
    publicDueDateText: null,
    birthJourney: "labor",
    theme: null,
    locale: null,
    photoId: null,
    thumbnailId: null,
    blurDataUrl: null,
    demo: false,
    lastActivityAt: 1,
    subscriptionCount: 0,
    deletedAt: null,
    ...opts,
  };
}

export function testProfileInsert(
  opts: Pick<InsertDoc<"userProfiles">, "userId" | "locale"> & Partial<InsertDoc<"userProfiles">>,
): InsertDoc<"userProfiles"> {
  return {
    tokenIdentifier: `https://convex.test|${opts.userId}`,
    timeZone: "Europe/London",
    isAdmin: false,
    ...opts,
  };
}

export function testOnboardingInsert(
  opts: Pick<InsertDoc<"userOnboarding">, "userId"> & Partial<InsertDoc<"userOnboarding">>,
): InsertDoc<"userOnboarding"> {
  return {
    tokenIdentifier: `https://convex.test|${opts.userId}`,
    completedSteps: [],
    welcomeDismissed: false,
    checklistDismissed: false,
    minimized: false,
    activeCoachmarkStepId: null,
    restartHintVisible: false,
    ...opts,
  };
}

export function testTimelineItemInsert(
  opts: Pick<InsertDoc<"timelineItems">, "babyId" | "kind" | "postedAt"> &
    Partial<InsertDoc<"timelineItems">>,
): InsertDoc<"timelineItems"> {
  return {
    deletedAt: null,
    ...opts,
  };
}

export function testUpdateInsert(
  opts: Pick<InsertDoc<"updates">, "babyId" | "timelineItemId"> & Partial<InsertDoc<"updates">>,
): InsertDoc<"updates"> {
  return {
    message: null,
    milestone: null,
    occurredAt: null,
    photoId: null,
    thumbnailId: null,
    blurDataUrl: null,
    pushImageId: null,
    postedByUserId: null,
    deletedAt: null,
    ...opts,
  };
}

export function testEncouragementInsert(
  opts: Pick<
    InsertDoc<"encouragements">,
    "babyId" | "authorName" | "message" | "createdAt" | "timelineItemId" | "visitorId"
  > &
    Partial<InsertDoc<"encouragements">>,
): InsertDoc<"encouragements"> {
  return {
    demoFixture: false,
    userAgent: null,
    locale: null,
    timezone: null,
    deletedAt: null,
    ...opts,
  };
}

export function testSubscriptionInsert(
  opts: Pick<
    InsertDoc<"pushSubscriptions">,
    "babyId" | "endpoint" | "p256dh" | "auth" | "createdAt"
  > &
    Partial<InsertDoc<"pushSubscriptions">>,
): InsertDoc<"pushSubscriptions"> {
  return {
    userAgent: null,
    ...opts,
  };
}

export function testNotificationInsert(
  opts: Pick<
    InsertDoc<"scheduledNotifications">,
    "babyId" | "status" | "scheduledFor" | "notificationType" | "createdAt"
  > &
    Partial<InsertDoc<"scheduledNotifications">>,
): InsertDoc<"scheduledNotifications"> {
  return {
    scheduledId: null,
    customMessage: null,
    photoId: null,
    updateId: null,
    ...opts,
  };
}

export function testCoParentInsert(
  opts: Pick<
    InsertDoc<"babyCoParents">,
    "babyId" | "userId" | "email" | "addedByUserId" | "addedAt"
  > &
    Partial<InsertDoc<"babyCoParents">>,
): InsertDoc<"babyCoParents"> {
  return {
    tokenIdentifier: `https://convex.test|${opts.userId}`,
    name: null,
    deletedAt: null,
    ...opts,
  };
}

export function testInviteInsert(
  opts: Pick<InsertDoc<"babyCoParentInvites">, "babyId" | "email" | "invitedByUserId" | "createdAt"> &
    Partial<InsertDoc<"babyCoParentInvites">>,
): InsertDoc<"babyCoParentInvites"> {
  return {
    deletedAt: null,
    ...opts,
  };
}
