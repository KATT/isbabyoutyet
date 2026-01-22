import { Dialog, DialogContent, DialogTrigger } from "@workspace/ui/components/dialog";
import { format } from "date-fns";
import { Activity, Baby, CheckCircle, Hospital, X } from "lucide-react";
import { useState } from "react";
import { Image } from "@unpic/react";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import {
  formatDate,
  getOverdueDays,
  getDaysUntilDueDate,
  getRelativeTime,
  parseDate,
} from "./utils";

type PhotoAvatarProps = {
  photoUrl: string | null | undefined;
  fallbackIcon: React.ReactNode;
  variant?: "default" | "born";
};

function PhotoAvatar({ photoUrl, fallbackIcon, variant = "default" }: PhotoAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);

  const baseClasses =
    "inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full border-2 mb-8 overflow-hidden";
  const variantClasses =
    variant === "born"
      ? "bg-linear-to-br from-primary to-primary/80 border-primary/30 shadow-xl shadow-primary/20"
      : "bg-linear-to-br from-primary/20 to-primary/10 border-primary/20 shadow-lg shadow-primary/10";

  if (!photoUrl) {
    return <div className={`${baseClasses} ${variantClasses}`}>{fallbackIcon}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className={`${baseClasses} ${variantClasses} cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
        >
          <Image
            src={photoUrl}
            alt="Baby"
            width={160}
            height={160}
            className="w-full h-full object-cover"
          />
        </button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl p-0 border-0 bg-transparent shadow-none">
        <button
          onClick={() => setIsOpen(false)}
          className="absolute -top-12 right-0 p-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
        <Image
          src={photoUrl}
          alt="Baby"
          width={1200}
          height={1200}
          className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
          layout="constrained"
        />
      </DialogContent>
    </Dialog>
  );
}

type StatusDisplayProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
  photoUrl?: string | null;
};

export function StatusDisplay({ baby, currentStatus, photoUrl }: StatusDisplayProps) {
  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);

  if (currentStatus.type === "not_yet") {
    return (
      <div className="flex flex-col items-center py-8">
        <PhotoAvatar
          photoUrl={photoUrl}
          fallbackIcon={<Baby className="w-16 h-16 md:w-20 md:h-20 text-primary" />}
        />
        <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Not yet
          </span>
        </h2>
        <p className="text-xl text-muted-foreground mb-6">Baby is still on the way</p>
        <div
          className={`mt-4 p-6 rounded-xl shadow-lg ${
            overdueDays > 0
              ? "bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 shadow-primary/10"
              : "bg-muted/50 border border-border"
          }`}
        >
          {overdueDays > 0 ? (
            <>
              <p className="text-xl font-bold text-primary">
                {overdueDays} {overdueDays === 1 ? "day" : "days"} overdue
              </p>
              <p className="text-sm text-primary/80 mt-2">
                Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
              </p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-foreground">
                {daysUntilDueDate} {daysUntilDueDate === 1 ? "day" : "days"} until due date
              </p>
              <p className="text-sm text-muted-foreground mt-2">
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
      <div className="flex flex-col items-center py-8">
        <PhotoAvatar
          photoUrl={photoUrl}
          fallbackIcon={<Activity className="w-16 h-16 md:w-20 md:h-20 text-primary" />}
        />
        <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Labour started
          </span>
        </h2>
        <p className="text-xl text-muted-foreground mb-2">Not gone to hospital yet</p>
        <p className="text-lg text-muted-foreground mt-2">
          Started at {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
        </p>
        {baby.laborStartedMessage && (
          <div className="mt-6 p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
            <p className="text-lg font-bold text-primary">{baby.laborStartedMessage}</p>
          </div>
        )}
      </div>
    );
  }

  if (currentStatus.type === "gone_to_hospital") {
    return (
      <div className="flex flex-col items-center py-8">
        <PhotoAvatar
          photoUrl={photoUrl}
          fallbackIcon={<Hospital className="w-16 h-16 md:w-20 md:h-20 text-primary" />}
        />
        <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Gone to hospital
          </span>
        </h2>
        <p className="text-xl text-muted-foreground mb-4">
          {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
        </p>
        {baby.hospitalMessage && (
          <div className="mt-6 p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
            <p className="text-lg font-bold text-primary">{baby.hospitalMessage}</p>
          </div>
        )}
      </div>
    );
  }

  // born
  return (
    <div className="flex flex-col items-center py-8">
      <PhotoAvatar
        photoUrl={photoUrl}
        fallbackIcon={<CheckCircle className="w-16 h-16 md:w-20 md:h-20 text-primary-foreground" />}
        variant="born"
      />
      <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
        <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
          Yes! Baby is out
        </span>
      </h2>
      <p className="text-xl text-muted-foreground mb-4">
        Born on {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
      </p>
      {baby.babyBornMessage && (
        <div className="mt-6 p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
          <p className="text-lg font-bold text-primary">{baby.babyBornMessage}</p>
        </div>
      )}
    </div>
  );
}
