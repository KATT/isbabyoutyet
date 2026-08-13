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
      {/* Compact journey: dashed path, solid fill for how far we've come */}
      <ol className="relative grid grid-cols-3 gap-1">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-5 right-[18%] left-[18%] border-t-2 border-dashed border-border"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-5 left-[18%] border-t-2 border-solid border-primary transition-[width] duration-300"
          style={{ width: `calc((100% - 36%) * ${progressValue / 100})` }}
        />
        {steps.map((step) => {
          const isCurrent = currentStatus.type === step.key;
          return (
            <li key={step.key} className="relative flex min-w-0 flex-col items-center text-center">
              <div
                className={`mb-1.5 flex h-10 w-10 items-center justify-center rounded-full border-2 text-lg transition-all duration-300 ${
                  step.completed
                    ? "border-primary bg-primary/15 pop-shadow"
                    : isCurrent
                      ? "border-primary/40 bg-card ring-2 ring-primary/15"
                      : "border-border bg-card opacity-60 grayscale"
                }`}
              >
                <span aria-hidden="true">{step.emoji}</span>
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
