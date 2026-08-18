import type { Doc } from "../convex/_generated/dataModel";

/**
 * Sentinel returned by manager-only queries when the caller lacks access,
 * instead of throwing. Lets route loaders fetch the same set of queries for
 * every visitor; read sites narrow it away.
 */
export const FORBIDDEN = "forbidden" as const;

/**
 * Core baby data shape used by both the real page (from Convex) and preview (from query params)
 */
export type BabyData = Omit<
  Doc<"baby">,
  | "userId"
  | "ownerTokenIdentifier"
  | "lastActivityAt"
  | "subscriptionCount"
  | "publicId"
  | "_id"
  | "_creationTime"
>;

/**
 * Persisted baby settings editable independently of timeline updates.
 */
export type BabyUpdate = Partial<
  Pick<BabyData, "name" | "dueDate" | "theme" | "locale" | "encouragementsDisabled">
>;

/**
 * Handler for updating baby data - abstracts mutations vs query param updates
 */
export type BabyUpdateHandler = (update: BabyUpdate) => void | Promise<void>;

export type MilestoneRedateHandler = (
  milestone: Milestone,
  occurredAt: string,
) => void | Promise<void>;

export type MilestoneRemoveHandler = (milestone: Milestone) => void | Promise<void>;

/**
 * Current status derived from marked milestones
 */
export type BabyStatus =
  | { type: "not_yet" }
  | { type: "labor_started"; date: string }
  | { type: "gone_to_hospital"; date: string }
  | { type: "born"; date: string };

/**
 * Event-clock dates for the three milestones. On the server these are inferred
 * from the latest active milestone updates; the preview page supplies them as
 * query params.
 */
export type MilestoneDates = {
  laborStarted: string | null;
  wentToHospital: string | null;
  babyBorn: string | null;
};

/**
 * Derive the current status from milestone dates. Later stages win, so a born
 * date implies the current status is born even if earlier dates are also set.
 */
export function getCurrentStatus(baby: Partial<MilestoneDates>): BabyStatus {
  if (baby.babyBorn) {
    return { type: "born", date: baby.babyBorn };
  }
  if (baby.wentToHospital) {
    return { type: "gone_to_hospital", date: baby.wentToHospital };
  }
  if (baby.laborStarted) {
    return { type: "labor_started", date: baby.laborStarted };
  }
  return { type: "not_yet" };
}

export const STATUS_ORDER = {
  not_yet: 0,
  labor_started: 1,
  gone_to_hospital: 2,
  born: 3,
} as const;

export type NotifiableStatus =
  | "labor_started"
  | "gone_to_hospital"
  | "born"
  | "photo_added"
  | "update_posted";

/**
 * Owner-postable milestone kinds — the status stages a feed update can mark.
 */
export type Milestone = "labor_started" | "gone_to_hospital" | "born";

export const MILESTONE_LABELS = {
  labor_started: "Labour started",
  gone_to_hospital: "Gone to hospital",
  born: "Born",
} as const satisfies Record<Milestone, string>;

/**
 * Maps a milestone to the settings date arg / DTO field and the legacy
 * per-stage message field.
 */
export const MILESTONE_FIELDS = {
  labor_started: { date: "laborStarted", message: "laborStartedMessage" },
  gone_to_hospital: { date: "wentToHospital", message: "hospitalMessage" },
  born: { date: "babyBorn", message: "babyBornMessage" },
} as const satisfies Record<Milestone, { date: keyof BabyData; message: keyof BabyData }>;

export const MILESTONES = Object.keys(MILESTONE_FIELDS) as Milestone[];

/**
 * Returns the latest marked milestone that must be removed before `milestone`
 * can be removed. Milestones are unwound in reverse order so inferred status
 * never contains gaps.
 */
export function getBlockingLaterMilestone(baby: Partial<MilestoneDates>, milestone: Milestone) {
  for (let index = MILESTONES.length - 1; index >= 0; index -= 1) {
    const candidate = MILESTONES[index];
    if (
      candidate &&
      STATUS_ORDER[candidate] > STATUS_ORDER[milestone] &&
      baby[MILESTONE_FIELDS[candidate].date]
    ) {
      return candidate;
    }
  }
  return null;
}

/**
 * Check if status moved forward (e.g., not_yet → labor_started → gone_to_hospital → born)
 * Type guard that narrows `after` to exclude "not_yet" when returning true
 */
export function isStatusForward(
  before: BabyStatus,
  after: BabyStatus,
): after is BabyStatus & { type: Milestone } {
  return STATUS_ORDER[after.type] > STATUS_ORDER[before.type];
}

export function isMilestoneNotificationType(
  notificationType: NotifiableStatus,
): notificationType is Milestone {
  return (
    notificationType === "labor_started" ||
    notificationType === "gone_to_hospital" ||
    notificationType === "born"
  );
}

export type Maybe<T> = T | null | undefined;
