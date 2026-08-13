import { Dialog, DialogContent, DialogTrigger } from "@workspace/ui/components/dialog";
import { format } from "date-fns";
import { X } from "lucide-react";
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
  fallbackEmoji: string;
  variant?: "default" | "born";
};

function PhotoAvatar({
  photoUrl,
  thumbnailUrl,
  fallbackEmoji,
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
    "inline-flex items-center justify-center w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 mb-6";
  const variantClasses =
    variant === "born"
      ? "bg-primary/15 border-primary pop-shadow-strong"
      : "bg-primary/10 border-primary/25 pop-shadow";

  // Use thumbnail for avatar, fallback to full photo if thumbnail not available
  const avatarImageUrl = thumbnailUrl ?? photoUrl;

  if (!avatarImageUrl && !photoUrl) {
    return (
      <div className={`${baseClasses} ${variantClasses}`}>
        <span className="text-6xl md:text-7xl" aria-hidden="true">
          {fallbackEmoji}
        </span>
      </div>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger
        render={
          <button
            className={`${baseClasses} ${variantClasses} cursor-pointer transition-transform hover:scale-105 hover:-rotate-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
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
    <div className="mt-8 w-full max-w-md rounded-3xl rounded-bl-lg border-2 border-primary/25 bg-primary/10 px-6 py-5 text-left rotate-[-1deg] pop-shadow">
      <p className="text-xs font-black uppercase tracking-widest text-primary/80">
        Latest from the family 💬
      </p>
      <p className="mt-2 text-lg font-bold leading-snug text-foreground break-words">
        {latestUpdate.message}
      </p>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">
        Updated {getRelativeTime(new Date(latestUpdate.postedAt).toISOString())}
      </p>
    </div>
  );
}

const STATUS_META = {
  not_yet: { emoji: "👶", answer: "Not yet", subline: "Baby is still on the way" },
  labor_started: { emoji: "💫", answer: "Labour started!", subline: "Not gone to hospital yet" },
  gone_to_hospital: { emoji: "🏥", answer: "Gone to hospital!", subline: "Almost there now" },
  born: { emoji: "🎉", answer: "Yes! Baby is out", subline: "Welcome to the world, little one" },
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
  const isBorn = currentStatus.type === "born";

  return (
    <div className="flex flex-col items-center py-8">
      <PhotoAvatar
        photoUrl={photoUrl}
        thumbnailUrl={thumbnailUrl}
        fallbackEmoji={meta.emoji}
        variant={isBorn ? "born" : "default"}
      />

      <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary text-balance">
        {meta.answer}
      </h2>
      <p className="mt-3 text-lg font-bold text-muted-foreground">{meta.subline}</p>

      {currentStatus.type !== "not_yet" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-1.5 text-sm font-semibold text-muted-foreground">
          {isBorn ? "Born" : currentStatus.type === "labor_started" ? "Started" : "Since"}{" "}
          {formatDate(currentStatus.date)} ({getRelativeTime(currentStatus.date)})
        </p>
      )}

      {currentStatus.type === "not_yet" && (
        <div
          className={`mt-6 rotate-[-2deg] rounded-3xl border-2 px-8 py-5 pop-shadow ${
            overdueDays > 0 ? "border-primary/40 bg-primary/10" : "border-border bg-card"
          }`}
        >
          <p
            className={`text-2xl font-black ${overdueDays > 0 ? "text-primary" : "text-foreground"}`}
          >
            {overdueDays > 0
              ? `${overdueDays} ${overdueDays === 1 ? "day" : "days"} overdue`
              : `${daysUntilDueDate} ${daysUntilDueDate === 1 ? "day" : "days"} until due date`}
          </p>
          <p className="mt-1 text-sm font-semibold text-muted-foreground">
            Due date: {format(parseDate(baby.dueDate), "MMMM d, yyyy")}
          </p>
        </div>
      )}

      <LatestUpdateBox latestUpdate={latestUpdate} />
    </div>
  );
}
