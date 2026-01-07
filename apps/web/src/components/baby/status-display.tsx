import { format } from "date-fns";
import { Activity, Baby, CheckCircle, Hospital } from "lucide-react";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import {
  formatDate,
  getOverdueDays,
  getDaysUntilDueDate,
  getRelativeTime,
  parseDate,
} from "./utils";

type StatusDisplayProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

export function StatusDisplay({ baby, currentStatus }: StatusDisplayProps) {
  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);

  if (currentStatus.type === "not_yet") {
    return (
      <div className="flex flex-col items-center py-4 md:py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-4 md:mb-8 shadow-lg shadow-primary/10">
          <Baby className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 text-primary" />
        </div>
        <h2 className="text-xl sm:text-3xl md:text-6xl font-black text-foreground mb-2 md:mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Not yet
          </span>
        </h2>
        <p className="text-base sm:text-xl text-muted-foreground mb-3 md:mb-6">
          Baby is still on the way
        </p>
        <div
          className={`mt-2 md:mt-4 p-4 md:p-6 rounded-xl shadow-lg ${
            overdueDays > 0
              ? "bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 shadow-primary/10"
              : "bg-muted/50 border border-border"
          }`}
        >
          {overdueDays > 0 ? (
            <>
              <p className="text-base sm:text-xl font-bold text-primary">
                {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
              </p>
              <p className="text-xs sm:text-sm text-primary/80 mt-1 sm:mt-2">
                Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
              </p>
            </>
          ) : (
            <>
              <p className="text-base sm:text-lg font-bold text-foreground">
                {daysUntilDueDate} {daysUntilDueDate === 1 ? "day" : "days"} until due date
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1 sm:mt-2">
                Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
              </p>
            </>
          )}
        </div>
      </div>
    );
  }

  if (currentStatus.type === "labor_started") {
    return (
      <div className="flex flex-col items-center py-4 md:py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-4 md:mb-8 shadow-lg shadow-primary/10">
          <Activity className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 text-primary" />
        </div>
        <h2 className="text-xl sm:text-3xl md:text-6xl font-black text-foreground mb-2 md:mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Labour started
          </span>
        </h2>
        <p className="text-base sm:text-xl text-muted-foreground mb-1 sm:mb-2">
          Not gone to hospital yet
        </p>
        <p className="text-sm sm:text-lg text-muted-foreground mt-1 sm:mt-2">
          Started at {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
        </p>
      </div>
    );
  }

  if (currentStatus.type === "gone_to_hospital") {
    return (
      <div className="flex flex-col items-center py-4 md:py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/20 mb-4 md:mb-8 shadow-lg shadow-primary/10">
          <Hospital className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 text-primary" />
        </div>
        <h2 className="text-xl sm:text-3xl md:text-6xl font-black text-foreground mb-2 md:mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Gone to hospital
          </span>
        </h2>
        <p className="text-base sm:text-xl text-muted-foreground mb-2 md:mb-4">
          {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
        </p>
        {baby.hospitalMessage && (
          <div className="mt-3 md:mt-6 p-4 md:p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
            <p className="text-base sm:text-lg font-bold text-primary">{baby.hospitalMessage}</p>
          </div>
        )}
      </div>
    );
  }

  // born
  return (
    <div className="flex flex-col items-center py-4 md:py-8">
      <div className="inline-flex items-center justify-center w-20 h-20 sm:w-28 sm:h-28 md:w-40 md:h-40 rounded-full bg-linear-to-br from-primary to-primary/80 border-2 border-primary/30 mb-4 md:mb-8 shadow-xl shadow-primary/20">
        <CheckCircle className="w-10 h-10 sm:w-14 sm:h-14 md:w-20 md:h-20 text-primary-foreground" />
      </div>
      <h2 className="text-xl sm:text-3xl md:text-6xl font-black text-foreground mb-2 md:mb-4 whitespace-nowrap">
        <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          Yes! Baby is out
        </span>
      </h2>
      <p className="text-base sm:text-xl text-muted-foreground mb-2 md:mb-4">
        Born on {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
      </p>
      {baby.babyBornMessage && (
        <div className="mt-3 md:mt-6 p-4 md:p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
          <p className="text-base sm:text-lg font-bold text-primary">{baby.babyBornMessage}</p>
        </div>
      )}
    </div>
  );
}
