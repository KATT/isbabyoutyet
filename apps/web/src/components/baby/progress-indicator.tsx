import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getRelativeTime } from "./utils";
import { useI18n } from "@/lib/i18n";
import { MILESTONE_LABEL_KEYS } from "./translation-keys";

type ProgressIndicatorProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

/** Badge size — keep in sync with the connector inset (`1.25rem` = half of `h-10`). */
const BADGE_CLASS = "h-10 w-10";
const BADGE_RADIUS = "1.25rem";
/** Matches `gap-1` on the milestone grid. */
const COLUMN_GAP = "0.25rem";

export function ProgressIndicator(props: ProgressIndicatorProps) {
  const { locale, t } = useI18n();
  const baby = props.baby;
  const currentStatus = props.currentStatus;

  // If a later status is set, earlier stages count as completed
  const steps = [
    {
      key: "labor_started",
      labelKey: MILESTONE_LABEL_KEYS.labor_started,
      emoji: "💫",
      date: baby.laborStarted,
      completed: !!baby.laborStarted || !!baby.wentToHospital || !!baby.babyBorn,
    },
    {
      key: "gone_to_hospital",
      labelKey: MILESTONE_LABEL_KEYS.gone_to_hospital,
      emoji: "🏥",
      date: baby.wentToHospital,
      completed: !!baby.wentToHospital || !!baby.babyBorn,
    },
    {
      key: "born",
      labelKey: MILESTONE_LABEL_KEYS.born,
      emoji: "🎉",
      date: baby.babyBorn,
      completed: !!baby.babyBorn,
    },
  ] as const;

  const progressValue = (() => {
    switch (currentStatus.type) {
      case "labor_started":
        return (1 / 3) * 100;
      case "gone_to_hospital":
        return (2 / 3) * 100;
      case "born":
        return 100;
      default:
        return 0;
    }
  })();

  return (
    <div
      className="w-full overflow-x-clip"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progressValue)}
    >
      {/*
        Connectors live between badge edges (not through centers). Each segment
        is drawn from this column and spans into the next: width = one column +
        gap − badge diameter so it stops at the next circle's rim.
      */}
      <ol className={`relative grid grid-cols-3 gap-1`}>
        {steps.map((step, index) => {
          const isCurrent = currentStatus.type === step.key;
          const isLast = index === steps.length - 1;
          // Fill the path into a milestone once that milestone is reached.
          const segmentFilled = !isLast && steps[index + 1]?.completed === true;

          return (
            <li key={step.key} className="relative flex min-w-0 flex-col items-center text-center">
              {!isLast && (
                <div
                  aria-hidden="true"
                  className={`pointer-events-none absolute top-5 z-0 border-t-2 ${
                    segmentFilled ? "border-solid border-primary" : "border-dashed border-border"
                  }`}
                  style={{
                    left: `calc(50% + ${BADGE_RADIUS})`,
                    width: `calc(100% + ${COLUMN_GAP} - (${BADGE_RADIUS} * 2))`,
                  }}
                />
              )}
              <div
                className={`relative z-10 mb-1.5 flex ${BADGE_CLASS} items-center justify-center rounded-full border-2 bg-card text-lg transition-all duration-300 ${
                  step.completed
                    ? "border-primary pop-shadow"
                    : isCurrent
                      ? "border-primary/40 ring-2 ring-primary/15"
                      : "border-border opacity-60 grayscale"
                }`}
              >
                {step.completed && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full bg-primary/15"
                  />
                )}
                <span aria-hidden="true" className="relative">
                  {step.emoji}
                </span>
              </div>
              <p
                className={`text-[11px] leading-tight font-extrabold text-balance sm:text-xs ${
                  step.completed
                    ? "text-foreground"
                    : isCurrent
                      ? "text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {t(step.labelKey)}
              </p>
              {step.date && (
                <p className="mt-1 max-w-full truncate rounded-full bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {getRelativeTime(step.date, locale)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
