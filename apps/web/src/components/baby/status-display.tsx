import { Dialog, DialogContent, DialogTrigger } from "@workspace/ui/components/dialog";
import { format } from "date-fns";
import { Activity, Baby, CheckCircle, Hospital, X } from "lucide-react";
import { useEffect, useState } from "react";
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
  thumbnailUrl: string | null | undefined;
  fallbackIcon: React.ReactNode;
  variant?: "default" | "born";
};

function PhotoAvatar({
  photoUrl,
  thumbnailUrl,
  fallbackIcon,
  variant = "default",
}: PhotoAvatarProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Prefetch the full-size image when component mounts or photoUrl changes
  useEffect(() => {
    if (photoUrl) {
      const link = document.createElement("link");
      link.rel = "prefetch";
      link.as = "image";
      link.href = photoUrl;
      document.head.appendChild(link);

      return () => {
        // Only remove if still in the document
        if (document.head.contains(link)) {
          document.head.removeChild(link);
        }
      };
    }
  }, [photoUrl]);

  const baseClasses =
    "inline-flex items-center justify-center w-32 h-32 md:w-40 md:h-40 rounded-full border-2 mb-8 overflow-hidden";
  const variantClasses =
    variant === "born"
      ? "bg-linear-to-br from-primary to-primary/80 border-primary/30 shadow-xl shadow-primary/20"
      : "bg-linear-to-br from-primary/20 to-primary/10 border-primary/20 shadow-lg shadow-primary/10";

  // Use thumbnail for avatar, fallback to full photo if thumbnail not available
  const avatarImageUrl = thumbnailUrl ?? photoUrl;

  if (!avatarImageUrl && !photoUrl) {
    return <div className={`${baseClasses} ${variantClasses}`}>{fallbackIcon}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button
            className={`${baseClasses} ${variantClasses} cursor-pointer transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
          >
            {avatarImageUrl && (
              <img
                src={avatarImageUrl}
                alt="Baby"
                width={160}
                height={160}
                className="w-full h-full object-cover"
              />
            )}
          </button>
        }
      />
      {photoUrl && (
        <DialogContent className="max-w-3xl p-0 border-0 bg-transparent shadow-none">
          <button
            onClick={() => setIsOpen(false)}
            className="absolute -top-12 right-0 p-2 rounded-full bg-background/80 backdrop-blur-sm text-foreground hover:bg-background transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={photoUrl}
            alt="Baby"
            className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
          />
        </DialogContent>
      )}
    </Dialog>
  );
}

/**
 * The newest owner update, shown on top of the status card regardless of
 * stage — a text-only post refreshes it without a status change.
 */
type LatestUpdateMessage = {
  message?: string | null;
  postedAt: number;
};

type StatusDisplayProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
  photoUrl?: string | null;
  thumbnailUrl?: string | null;
  latestUpdate?: LatestUpdateMessage | null;
};

function LatestUpdateBox(props: { latestUpdate?: LatestUpdateMessage | null }) {
  const latestUpdate = props.latestUpdate;
  if (!latestUpdate?.message) {
    return null;
  }
  return (
    <div className="mt-6 p-6 bg-linear-to-br from-primary/20 to-primary/10 border-2 border-primary/30 rounded-xl w-full max-w-md shadow-lg shadow-primary/10">
      <p className="text-xs font-semibold uppercase tracking-wide text-primary/70 mb-2">
        Latest from the family
      </p>
      <p className="text-lg font-bold text-primary break-words">{latestUpdate.message}</p>
      <p className="text-xs text-primary/70 mt-2">
        Updated {getRelativeTime(new Date(latestUpdate.postedAt).toISOString())}
      </p>
    </div>
  );
}

export function StatusDisplay({
  baby,
  currentStatus,
  photoUrl,
  thumbnailUrl,
  latestUpdate,
}: StatusDisplayProps) {
  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);

  if (currentStatus.type === "not_yet") {
    return (
      <div className="flex flex-col items-center py-8">
        <PhotoAvatar
          photoUrl={photoUrl}
          thumbnailUrl={thumbnailUrl}
          fallbackIcon={<Baby className="w-16 h-16 md:w-20 md:h-20 text-primary" />}
        />
        <h2 className="text-3xl md:text-6xl font-black text-foreground mb-4 whitespace-nowrap">
          <span className="bg-linear-to-r from-primary to-primary/80 bg-clip-text text-transparent">
            Not yet
          </span>
        </h2>
        <p className="text-xl text-muted-foreground mb-6">Baby is still on the way</p>
        <LatestUpdateBox latestUpdate={latestUpdate} />
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
          thumbnailUrl={thumbnailUrl}
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
        <LatestUpdateBox latestUpdate={latestUpdate} />
      </div>
    );
  }

  if (currentStatus.type === "gone_to_hospital") {
    return (
      <div className="flex flex-col items-center py-8">
        <PhotoAvatar
          photoUrl={photoUrl}
          thumbnailUrl={thumbnailUrl}
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
        <LatestUpdateBox latestUpdate={latestUpdate} />
      </div>
    );
  }

  // born
  return (
    <div className="flex flex-col items-center py-8">
      <PhotoAvatar
        photoUrl={photoUrl}
        thumbnailUrl={thumbnailUrl}
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
      <LatestUpdateBox latestUpdate={latestUpdate} />
    </div>
  );
}
