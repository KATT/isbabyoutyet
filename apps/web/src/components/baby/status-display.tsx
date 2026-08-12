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
    "inline-flex shrink-0 items-center justify-center w-16 h-16 md:w-20 md:h-20 rounded-2xl overflow-hidden border";
  const variantClasses =
    variant === "born"
      ? "bg-primary border-primary text-primary-foreground"
      : "bg-primary/10 border-border text-primary";

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
            className={`${baseClasses} ${variantClasses} cursor-pointer transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
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
    <div className="mt-5 border-l-2 border-primary/50 pl-3.5">
      <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Latest from the family
      </p>
      <p className="mt-1 text-sm font-medium leading-relaxed text-foreground break-words">
        {latestUpdate.message}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">
        Updated {getRelativeTime(new Date(latestUpdate.postedAt).toISOString())}
      </p>
    </div>
  );
}

const STATUS_META = {
  not_yet: { icon: Baby, answer: "Not yet", subline: "Baby is still on the way" },
  labor_started: { icon: Activity, answer: "Labour started", subline: "Not gone to hospital yet" },
  gone_to_hospital: { icon: Hospital, answer: "Gone to hospital", subline: "Almost there now" },
  born: { icon: CheckCircle, answer: "Yes! Baby is out", subline: "Welcome to the world" },
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
  const meta = STATUS_META[currentStatus.type];
  const StatusIcon = meta.icon;
  const isBorn = currentStatus.type === "born";

  return (
    <div>
      <div className="flex items-start gap-4">
        <PhotoAvatar
          photoUrl={photoUrl}
          thumbnailUrl={thumbnailUrl}
          variant={isBorn ? "born" : "default"}
          fallbackIcon={<StatusIcon className="w-8 h-8 md:w-9 md:h-9" />}
        />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            Current status
          </p>
          <h2 className="mt-1 text-3xl font-bold tracking-tight text-primary md:text-4xl">
            {meta.answer}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">{meta.subline}</p>
        </div>
      </div>

      {currentStatus.type === "not_yet" ? (
        <div
          className={`mt-5 rounded-lg px-4 py-3 ${
            overdueDays > 0 ? "bg-primary/10" : "bg-muted/50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${overdueDays > 0 ? "text-primary" : "text-foreground"}`}
          >
            {overdueDays > 0
              ? `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`
              : `${daysUntilDueDate} ${daysUntilDueDate === 1 ? "day" : "days"} until due date`}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-lg bg-muted/50 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">
            {isBorn ? "Born" : currentStatus.type === "labor_started" ? "Started" : "Since"}{" "}
            {getRelativeTime(currentStatus.date)}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">{formatDate(currentStatus.date)}</p>
        </div>
      )}

      <LatestUpdateBox latestUpdate={latestUpdate} />
    </div>
  );
}
