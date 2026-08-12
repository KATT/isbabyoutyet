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
    "inline-flex items-center justify-center w-28 h-28 md:w-36 md:h-36 rounded-full overflow-hidden ring-4 ring-background shadow-lg";
  const variantClasses =
    variant === "born"
      ? "bg-linear-to-br from-primary to-primary/80 shadow-primary/25"
      : "bg-linear-to-br from-primary/15 to-primary/5 shadow-primary/10 border border-primary/20";

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
    <figure className="mt-8 w-full max-w-md rounded-2xl border border-primary/15 bg-accent/40 px-6 py-5 text-center">
      <figcaption className="text-[0.7rem] font-semibold uppercase tracking-[0.2em] text-primary/80">
        Latest from the family
      </figcaption>
      <blockquote className="mt-2 font-serif text-lg italic leading-snug text-foreground break-words">
        “{latestUpdate.message}”
      </blockquote>
      <p className="mt-2 text-xs text-muted-foreground">
        Updated {getRelativeTime(new Date(latestUpdate.postedAt).toISOString())}
      </p>
    </figure>
  );
}

const STATUS_ICONS = {
  not_yet: Baby,
  labor_started: Activity,
  gone_to_hospital: Hospital,
  born: CheckCircle,
} as const;

export function StatusDisplay({
  baby,
  currentStatus,
  photoUrl,
  thumbnailUrl,
  latestUpdate,
}: StatusDisplayProps) {
  const overdueDays = getOverdueDays(baby.dueDate);
  const daysUntilDueDate = getDaysUntilDueDate(baby.dueDate);
  const StatusIcon = STATUS_ICONS[currentStatus.type];
  const isBorn = currentStatus.type === "born";

  const answer = {
    not_yet: "Not yet",
    labor_started: "Labour started",
    gone_to_hospital: "Gone to hospital",
    born: "Yes! Baby is out",
  }[currentStatus.type];

  const subline = {
    not_yet: "Baby is still on the way",
    labor_started: "Not gone to hospital yet",
    gone_to_hospital: "Almost there now",
    born: "Welcome to the world, little one",
  }[currentStatus.type];

  return (
    <div className="flex flex-col items-center">
      <div className="-mt-16 md:-mt-20 mb-6">
        <PhotoAvatar
          photoUrl={photoUrl}
          thumbnailUrl={thumbnailUrl}
          variant={isBorn ? "born" : "default"}
          fallbackIcon={
            <StatusIcon
              className={`w-12 h-12 md:w-16 md:h-16 ${isBorn ? "text-primary-foreground" : "text-primary"}`}
            />
          }
        />
      </div>

      <p className="text-[0.7rem] font-semibold uppercase tracking-[0.25em] text-muted-foreground">
        The answer is
      </p>
      <h2 className="mt-2 font-serif text-5xl md:text-7xl font-semibold tracking-tight text-primary text-balance">
        {answer}
      </h2>
      <p className="mt-3 font-serif text-lg md:text-xl italic text-muted-foreground">{subline}</p>

      {currentStatus.type !== "not_yet" && (
        <p className="mt-3 text-sm text-muted-foreground">
          {isBorn ? "Born on" : currentStatus.type === "labor_started" ? "Started at" : ""}{" "}
          {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
        </p>
      )}

      {currentStatus.type === "not_yet" && (
        <div
          className={`mt-6 inline-flex flex-col items-center gap-1 rounded-2xl px-6 py-4 ${
            overdueDays > 0
              ? "border border-primary/25 bg-primary/10"
              : "border border-border bg-muted/40"
          }`}
        >
          <p
            className={`font-serif text-2xl font-semibold ${overdueDays > 0 ? "text-primary" : "text-foreground"}`}
          >
            {overdueDays > 0
              ? `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`
              : `${daysUntilDueDate} ${daysUntilDueDate === 1 ? "day" : "days"} until due date`}
          </p>
          <p className="text-xs text-muted-foreground">
            Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
          </p>
        </div>
      )}

      <LatestUpdateBox latestUpdate={latestUpdate} />
    </div>
  );
}
