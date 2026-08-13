import { Progress } from "@workspace/ui/components/progress";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getRelativeTime } from "./utils";

type ProgressIndicatorProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

export function ProgressIndicator(props: ProgressIndicatorProps) {
  const baby = props.baby;
  const currentStatus = props.currentStatus;

  // If a later status is set, earlier stages count as completed
  const steps = [
    {
      key: "labor_started",
      label: "Labour started",
      emoji: "💫",
      date: baby.laborStarted,
      completed: !!baby.laborStarted || !!baby.wentToHospital || !!baby.babyBorn,
    },
    {
      key: "gone_to_hospital",
      label: "Gone to hospital",
      emoji: "🏥",
      date: baby.wentToHospital,
      completed: !!baby.wentToHospital || !!baby.babyBorn,
    },
    {
      key: "born",
      label: "Baby born",
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
    <div className="w-full">
      {/* The journey: three big badges on a dashed path */}
      <ol className="relative mb-6 grid grid-cols-3 gap-2 before:absolute before:left-[16%] before:right-[16%] before:top-8 before:border-t-2 before:border-dashed before:border-border">
        {steps.map((step) => {
          const isCurrent = currentStatus.type === step.key;
          return (
            <li key={step.key} className="relative flex flex-col items-center text-center">
              <div
                className={`mb-2.5 flex h-16 w-16 items-center justify-center rounded-full border-2 text-2xl transition-all duration-300 ${
                  step.completed
                    ? "border-primary bg-primary/15 pop-shadow scale-105"
                    : isCurrent
                      ? "border-primary/40 bg-card ring-4 ring-primary/15"
                      : "border-border bg-card opacity-60 grayscale"
                }`}
              >
                <span aria-hidden="true">{step.emoji}</span>
              </div>
              <p
                className={`text-sm md:text-base font-extrabold ${
                  step.completed
                    ? "text-foreground"
                    : isCurrent
                      ? "text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </p>
              {step.date && (
                <p className="mt-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
                  {getRelativeTime(step.date)}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <Progress value={progressValue} className="h-3 rounded-full" />
    </div>
  );
}
