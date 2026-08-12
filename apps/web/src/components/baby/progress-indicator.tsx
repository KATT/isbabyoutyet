import { Progress } from "@workspace/ui/components/progress";
import { Activity, CheckCircle, Hospital } from "lucide-react";
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
      icon: Activity,
      date: baby.laborStarted,
      completed: !!baby.laborStarted || !!baby.wentToHospital || !!baby.babyBorn,
    },
    {
      key: "gone_to_hospital",
      label: "Gone to hospital",
      icon: Hospital,
      date: baby.wentToHospital,
      completed: !!baby.wentToHospital || !!baby.babyBorn,
    },
    {
      key: "born",
      label: "Baby born",
      icon: CheckCircle,
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
      <ol className="mb-5 grid grid-cols-3 gap-2">
        {steps.map((step) => {
          const isCurrent = currentStatus.type === step.key;
          const StepIcon = step.icon;
          return (
            <li key={step.key} className="flex flex-col items-center text-center">
              <div
                className={`mb-2 flex h-11 w-11 items-center justify-center rounded-full transition-colors duration-300 ${
                  step.completed
                    ? "bg-primary text-primary-foreground shadow-md shadow-primary/25"
                    : isCurrent
                      ? "border border-primary/30 bg-primary/10 text-primary"
                      : "border border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                <StepIcon className="h-5 w-5" />
              </div>
              <p
                className={`text-xs md:text-sm font-medium ${
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
                <p className="mt-0.5 text-xs text-muted-foreground">{getRelativeTime(step.date)}</p>
              )}
            </li>
          );
        })}
      </ol>
      <Progress value={progressValue} className="h-1.5" />
    </div>
  );
}
