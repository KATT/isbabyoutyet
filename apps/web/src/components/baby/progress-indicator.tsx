import { Progress } from "@workspace/ui/components/progress";
import { Activity, CheckCircle, Hospital } from "lucide-react";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getRelativeTime } from "./utils";

type ProgressIndicatorProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

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
        {/* Labour started */}
        <div className="flex flex-col items-center flex-1">
          <div
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
              isLaborCompletedForProgress
                ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                : currentStatus.type === "labor_started"
                  ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                  : "bg-muted/50 text-muted-foreground border border-border"
            }`}
          >
            <Activity className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <p
            className={`text-sm md:text-base font-semibold mb-1 ${
              isLaborCompletedForProgress
                ? "text-foreground"
                : currentStatus.type === "labor_started"
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
          >
            Labour started
          </p>
          {baby.laborStarted && (
            <p className="text-xs text-muted-foreground mt-1">
              {getRelativeTime(baby.laborStarted)}
            </p>
          )}
        </div>

        {/* Gone to hospital */}
        <div className="flex flex-col items-center flex-1">
          <div
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
              isGoneToHospitalCompletedForProgress
                ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                : currentStatus.type === "gone_to_hospital"
                  ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                  : "bg-muted/50 text-muted-foreground border border-border"
            }`}
          >
            <Hospital className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <p
            className={`text-sm md:text-base font-semibold mb-1 ${
              isGoneToHospitalCompletedForProgress
                ? "text-foreground"
                : currentStatus.type === "gone_to_hospital"
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
          >
            Gone to hospital
          </p>
          {baby.wentToHospital && (
            <p className="text-xs text-muted-foreground mt-1">
              {getRelativeTime(baby.wentToHospital)}
            </p>
          )}
        </div>

        {/* Baby born */}
        <div className="flex flex-col items-center flex-1">
          <div
            className={`w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center mb-3 transition-all duration-300 ${
              isBornCompletedForProgress
                ? "bg-linear-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/20 scale-110"
                : currentStatus.type === "born"
                  ? "bg-linear-to-br from-primary/30 to-primary/20 text-primary border-2 border-primary/30 shadow-md"
                  : "bg-muted/50 text-muted-foreground border border-border"
            }`}
          >
            <CheckCircle className="w-10 h-10 md:w-12 md:h-12" />
          </div>
          <p
            className={`text-sm md:text-base font-semibold mb-1 ${
              isBornCompletedForProgress
                ? "text-foreground"
                : currentStatus.type === "born"
                  ? "text-primary"
                  : "text-muted-foreground"
            }`}
          >
            Baby born
          </p>
          {baby.babyBorn && (
            <p className="text-xs text-muted-foreground mt-1">{getRelativeTime(baby.babyBorn)}</p>
          )}
        </div>
      </div>
      {/* Progress bar */}
      <Progress value={progressValue} />
    </div>
  );
}
