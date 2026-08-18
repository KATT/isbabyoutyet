import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getRelativeTime } from "./utils";
import { useI18n } from "@/lib/i18n";
import { MILESTONE_LABEL_KEYS } from "./translation-keys";

type ProgressIndicatorProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

export function ProgressIndicator(props: ProgressIndicatorProps) {
  const { locale, t } = useI18n();
  const baby = props.baby;

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
    switch (props.currentStatus.type) {
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

  const lastIndex = steps.length - 1;

  return (
    <div
      className="w-full overflow-x-clip"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(progressValue)}
    >
      {/*
        Each column owns a left half-line + badge + right half-line. Adjacent
        halves meet between columns, so the stroke reaches the rim and never
        crosses the badge face.
      */}
      <ol className="grid grid-cols-3">
        {steps.map((step, index) => {
          const isCurrent = props.currentStatus.type === step.key;
          // Path into this milestone fills once the milestone itself is reached.
          const leftFilled = index > 0 && step.completed;
          // Path onward fills once the next milestone is reached.
          const rightFilled = index < lastIndex && steps[index + 1]?.completed === true;

          return (
            <li key={step.key} className="flex min-w-0 flex-col items-center text-center">
              <div className="mb-1.5 flex w-full items-center">
                <div
                  aria-hidden="true"
                  className={`h-0 min-w-0 flex-1 border-t-2 ${
                    index === 0
                      ? "border-transparent"
                      : leftFilled
                        ? "border-solid border-primary"
                        : "border-dashed border-border"
                  }`}
                />
                <div
                  className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-card text-lg transition-all duration-300 ${
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
                <div
                  aria-hidden="true"
                  className={`h-0 min-w-0 flex-1 border-t-2 ${
                    index === lastIndex
                      ? "border-transparent"
                      : rightFilled
                        ? "border-solid border-primary"
                        : "border-dashed border-border"
                  }`}
                />
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
