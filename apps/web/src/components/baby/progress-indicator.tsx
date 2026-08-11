import { Progress } from "@workspace/ui/components/progress";
import { Activity, CheckCircle, Hospital } from "lucide-react";
import type { BabyData, BabyStatus, Maybe } from "@workspace/convex/src/types";
import { getRelativeTime } from "./utils";

type ProgressIndicatorProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

type ProgressStepProps = {
  icon: React.ReactNode;
  label: string;
  date: Maybe<string>;
  isCompleted: boolean;
  isActive: boolean;
};

function ProgressStep(props: ProgressStepProps) {
  const circleClasses = props.isCompleted
    ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
    : props.isActive
      ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
      : "bg-muted/50 text-muted-foreground border border-border";
  const labelClasses = props.isCompleted
    ? "text-foreground"
    : props.isActive
      ? "text-primary"
      : "text-muted-foreground";

  return (
    <div className="flex flex-col items-center flex-1">
      <div
        className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${circleClasses}`}
      >
        {props.icon}
      </div>
      <p className={`text-sm md:text-base font-semibold mb-1 ${labelClasses}`}>{props.label}</p>
      {props.date && (
        <p className="text-xs text-muted-foreground mt-1">{getRelativeTime(props.date)}</p>
      )}
    </div>
  );
}

export function ProgressIndicator({ baby, currentStatus }: ProgressIndicatorProps) {
  // For progress bar: if a later status is set, show previous statuses as completed
  const isLaborCompletedForProgress =
    !!baby.laborStarted || !!baby.wentToHospital || !!baby.babyBorn;
  const isGoneToHospitalCompletedForProgress = !!baby.wentToHospital || !!baby.babyBorn;
  const isBornCompletedForProgress = !!baby.babyBorn;

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
      <div className="flex items-center justify-between mb-4">
        <ProgressStep
          icon={<Activity className="w-10 h-10 md:w-12 md:h-12" />}
          label="Labour started"
          date={baby.laborStarted}
          isCompleted={isLaborCompletedForProgress}
          isActive={currentStatus.type === "labor_started"}
        />
        <ProgressStep
          icon={<Hospital className="w-10 h-10 md:w-12 md:h-12" />}
          label="Gone to hospital"
          date={baby.wentToHospital}
          isCompleted={isGoneToHospitalCompletedForProgress}
          isActive={currentStatus.type === "gone_to_hospital"}
        />
        <ProgressStep
          icon={<CheckCircle className="w-10 h-10 md:w-12 md:h-12" />}
          label="Baby born"
          date={baby.babyBorn}
          isCompleted={isBornCompletedForProgress}
          isActive={currentStatus.type === "born"}
        />
      </div>
      {/* Progress bar */}
      <Progress value={progressValue} />
    </div>
  );
}
