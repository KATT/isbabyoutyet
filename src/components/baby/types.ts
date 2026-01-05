/**
 * Core baby data shape used by both the real page (from Convex) and preview (from query params)
 */
export type BabyData = {
  name: string;
  dueDate: string;
  theme: string | null;
  laborStarted: string | null;
  wentToHospital: string | null;
  babyBorn: string | null;
  customMessage: string | null;
  babyBornMessage: string | null;
};

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
