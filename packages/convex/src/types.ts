import type { Doc } from "../convex/_generated/dataModel";

/**
 * Core baby data shape used by both the real page (from Convex) and preview (from query params)
 */
export type BabyData = Omit<Doc<"baby">, "userId" | "publicId" | "_id" | "_creationTime">;

/**
 * Partial update to baby data - used by editors
 */
export type BabyUpdate = Partial<BabyData>;

/**
 * Handler for updating baby data - abstracts mutations vs query param updates
 */
export type BabyUpdateHandler = (update: BabyUpdate) => void | Promise<void>;

/**
 * Current status derived from baby data
 */
export type BabyStatus =
  | { type: "not_yet" }
  | { type: "labor_started"; date: string }
  | { type: "gone_to_hospital"; date: string }
  | { type: "born"; date: string };

/**
 * Derive the current status from baby data
 */
export function getCurrentStatus(baby: BabyData): BabyStatus {
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

export type NotifiableStatus = "labor_started" | "gone_to_hospital" | "born" | "photo_added";

/**
 * Owner-postable milestone kinds — the status stages a feed update can mark.
 */
export type Milestone = "labor_started" | "gone_to_hospital" | "born";

/**
 * Maps a milestone to the baby fields that hold its canonical timestamp and
 * its legacy per-stage message.
 */
export const MILESTONE_FIELDS = {
  labor_started: { date: "laborStarted", message: "laborStartedMessage" },
  gone_to_hospital: { date: "wentToHospital", message: "hospitalMessage" },
  born: { date: "babyBorn", message: "babyBornMessage" },
} as const satisfies Record<Milestone, { date: keyof BabyData; message: keyof BabyData }>;

export const MILESTONES = Object.keys(MILESTONE_FIELDS) as Milestone[];

/**
 * Check if status moved forward (e.g., not_yet → labor_started → gone_to_hospital → born)
 * Type guard that narrows `after` to exclude "not_yet" when returning true
 */
export function isStatusForward(
  before: BabyStatus,
  after: BabyStatus,
): after is BabyStatus & { type: NotifiableStatus } {
  return STATUS_ORDER[after.type] > STATUS_ORDER[before.type];
}

export type Maybe<T> = T | null | undefined;
