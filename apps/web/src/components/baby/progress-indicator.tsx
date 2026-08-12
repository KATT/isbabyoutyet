import { Progress } from "@workspace/ui/components/progress";
import { Activity, Check, CheckCircle, Hospital } from "lucide-react";
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
      <div className="mb-4 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Journey
        </p>
        <p className="text-xs tabular-nums text-muted-foreground">{Math.round(progressValue)}%</p>
      </div>
      <Progress value={progressValue} className="h-1" />
      <ol className="mt-4 space-y-2.5">
        {steps.map((step) => {
          const isCurrent = currentStatus.type === step.key;
          const StepIcon = step.icon;
          return (
            <li key={step.key} className="flex items-center gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  step.completed
                    ? "border-primary bg-primary text-primary-foreground"
                    : isCurrent
                      ? "border-primary/50 bg-primary/10 text-primary"
                      : "border-border bg-muted/40 text-muted-foreground"
                }`}
              >
                {step.completed ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <StepIcon className="h-3.5 w-3.5" />
                )}
              </span>
              <span
                className={`text-sm ${
                  step.completed
                    ? "font-medium text-foreground"
                    : isCurrent
                      ? "font-medium text-primary"
                      : "text-muted-foreground"
                }`}
              >
                {step.label}
              </span>
              {step.date && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {getRelativeTime(step.date)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
