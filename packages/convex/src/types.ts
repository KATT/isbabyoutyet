import type { Doc } from "../convex/_generated/dataModel";

export const BIRTH_JOURNEYS = ["labour", "planned_c_section", "home_birth"] as const;

export type BirthJourney = (typeof BIRTH_JOURNEYS)[number];

export type MilestoneVisibility = {
  showLabor: boolean;
  showHospital: boolean;
};

export function isBirthJourney(value: string): value is BirthJourney {
  return BIRTH_JOURNEYS.some((journey) => journey === value);
}

export function getBirthJourney(baby: { birthJourney?: BirthJourney | null }): BirthJourney {
  return baby.birthJourney ?? "labour";
}

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
> &
  Partial<{ milestoneVisibility: MilestoneVisibility }>;

/**
 * Partial update to baby data - used by editors
 */
export type BabyUpdate = Partial<Omit<BabyData, "milestoneVisibility">>;

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
export function getCurrentStatus(baby: {
  birthJourney?: BirthJourney | null;
  milestoneVisibility?: MilestoneVisibility | null;
  babyBorn?: string | null;
  wentToHospital?: string | null;
  laborStarted?: string | null;
}): BabyStatus {
  if (baby.babyBorn) {
    return { type: "born", date: baby.babyBorn };
  }
  if (baby.wentToHospital) {
    return { type: "gone_to_hospital", date: baby.wentToHospital };
  }
  if (isMilestoneInJourney(baby, "labor_started") && baby.laborStarted) {
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

const MILESTONES_BY_BIRTH_JOURNEY = {
  labour: ["labor_started", "gone_to_hospital", "born"],
  planned_c_section: ["gone_to_hospital", "born"],
  home_birth: ["labor_started", "born"],
} as const satisfies Record<BirthJourney, readonly Milestone[]>;

export function getMilestonesForJourney(baby: {
  birthJourney?: BirthJourney | null;
  milestoneVisibility?: MilestoneVisibility | null;
}): readonly Milestone[] {
  if (baby.birthJourney == null && baby.milestoneVisibility) {
    return MILESTONES_BY_BIRTH_JOURNEY.labour.filter(
      (milestone) =>
        milestone === "born" ||
        (milestone === "labor_started"
          ? baby.milestoneVisibility?.showLabor
          : baby.milestoneVisibility?.showHospital),
    );
  }
  return MILESTONES_BY_BIRTH_JOURNEY[getBirthJourney(baby)];
}

export function isMilestoneInJourney(
  baby: {
    birthJourney?: BirthJourney | null;
    milestoneVisibility?: MilestoneVisibility | null;
  },
  milestone: Milestone,
) {
  return getMilestonesForJourney(baby).some((candidate) => candidate === milestone);
}

export function getPublicMilestoneVisibility(baby: {
  birthJourney?: BirthJourney | null;
}): MilestoneVisibility {
  const milestones = getMilestonesForJourney(baby);
  return {
    showLabor: milestones.includes("labor_started"),
    showHospital: milestones.includes("gone_to_hospital"),
  };
}

export function isPlannedDateJourney(baby: {
  birthJourney?: BirthJourney | null;
  milestoneVisibility?: MilestoneVisibility | null;
}) {
  const milestones = getMilestonesForJourney(baby);
  return !milestones.includes("labor_started") && milestones.includes("gone_to_hospital");
}

export const MILESTONE_LABELS = {
  labor_started: "Labour started",
  gone_to_hospital: "Gone to hospital",
  born: "Born",
} as const satisfies Record<Milestone, string>;

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
 * Returns the latest marked milestone that must be removed before `milestone`
 * can be removed. Milestones are unwound in reverse order so the canonical
 * status never contains gaps.
 */
export function getBlockingLaterMilestone(baby: BabyData, milestone: Milestone) {
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
): after is BabyStatus & { type: NotifiableStatus } {
  return STATUS_ORDER[after.type] > STATUS_ORDER[before.type];
}

export type Maybe<T> = T | null | undefined;
