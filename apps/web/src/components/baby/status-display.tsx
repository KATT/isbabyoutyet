import { Link } from "@tanstack/react-router";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getMilestonePolicy } from "@workspace/convex/src/types";
import {
  formatDate,
  getOverdueDays,
  getDaysUntilDueDate,
  getRelativeTime,
  formatDueDate,
} from "./utils";
import { useI18n } from "@/lib/i18n";
import { openOverlayLink } from "@/lib/overlay-nav";
import { BlurImage } from "@/components/blur-image";

type PhotoAvatarProps = {
  publicId: string | null;
  babyName: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
  fallbackEmoji: string;
  variant: "default" | "born";
};

function PhotoAvatar(props: PhotoAvatarProps) {
  const { t } = useI18n();

  const baseClasses =
    "inline-flex items-center justify-center w-28 h-28 md:w-32 md:h-32 rounded-full overflow-hidden border-4 mb-6";
  const variantClasses =
    props.variant === "born"
      ? "bg-primary/15 border-primary pop-shadow-strong"
      : "bg-primary/10 border-primary/25 pop-shadow";

  // Use thumbnail for avatar, fallback to full photo if thumbnail not available
  const avatarImageUrl = props.thumbnailUrl ?? props.photoUrl;

  if (!avatarImageUrl && !props.photoUrl) {
    return (
      <div className={`${baseClasses} ${variantClasses}`}>
        <span className="text-6xl md:text-7xl" aria-hidden="true">
          {props.fallbackEmoji}
        </span>
      </div>
    );
  }

  const avatarImage = avatarImageUrl ? (
    <BlurImage
      src={avatarImageUrl}
      alt={t("Photo of {{name}}", { name: props.babyName })}
      width={160}
      height={160}
      blurDataUrl={props.blurDataUrl}
      className="h-full w-full object-cover"
    />
  ) : null;

  if (props.photoUrl && props.publicId) {
    return (
      <Link
        {...openOverlayLink({
          to: "/baby/$publicId/photo",
          params: { publicId: props.publicId },
        })}
        aria-label={t("Photo of {{name}}", { name: props.babyName })}
        className={`${baseClasses} ${variantClasses} cursor-pointer transition-transform hover:scale-105 hover:-rotate-2 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2`}
      >
        {avatarImage}
      </Link>
    );
  }

  return <div className={`${baseClasses} ${variantClasses}`}>{avatarImage}</div>;
}

/**
 * The newest owner update, shown on top of the status card regardless of
 * stage — a text-only post refreshes it without a status change.
 */
type LatestUpdateMessage = {
  message: string | null;
  postedAt: number;
};

type StatusDisplayProps = {
  publicId: string | null;
  baby: BabyData;
  currentStatus: BabyStatus;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
  latestUpdate: LatestUpdateMessage | null;
};

function LatestUpdateBox(props: { latestUpdate: LatestUpdateMessage | null }) {
  const { locale, t } = useI18n();
  const latestUpdate = props.latestUpdate;
  if (!latestUpdate?.message) {
    return null;
  }
  return (
    <div className="mt-8 w-full max-w-md rounded-3xl rounded-bl-lg border-2 border-primary/25 bg-primary/10 px-6 py-5 text-left rotate-[-1deg] pop-shadow">
      <p className="text-xs font-black uppercase tracking-widest text-primary/80">
        {t("Latest from the family")} 💬
      </p>
      <p className="mt-2 text-lg font-bold leading-snug text-foreground break-words">
        {latestUpdate.message}
      </p>
      <p className="mt-2 text-xs font-semibold text-muted-foreground">
        {t("Updated {{relative}}", {
          relative: getRelativeTime(new Date(latestUpdate.postedAt).toISOString(), locale),
        })}
      </p>
    </div>
  );
}

const STATUS_META = {
  not_yet: { emoji: "👶", answerKey: "Not yet", sublineKey: "Baby is still on the way" },
  labor_started: {
    emoji: "💫",
    answerKey: "Labour started!",
    sublineKey: "Not gone to hospital yet",
  },
  gone_to_hospital: {
    emoji: "🏥",
    answerKey: "Gone to hospital!",
    sublineKey: "Almost there now",
  },
  born: {
    emoji: "🎉",
    answerKey: "Yes! Baby is out",
    sublineKey: "Welcome to the world, little one",
  },
} as const;

export function StatusDisplay(props: StatusDisplayProps) {
  const { locale, t } = useI18n();
  const isMessageMode = props.baby.dueDateDisplayMode === "message";
  const publicDueDateText = props.baby.publicDueDateText?.trim() ?? "";
  const exactDueDate = isMessageMode ? null : props.baby.dueDate;
  const showDueDateBox =
    props.currentStatus.type === "not_yet" &&
    (publicDueDateText.length > 0 || exactDueDate !== null);
  const overdueDays = exactDueDate ? getOverdueDays(exactDueDate, props.baby.timeZone) : 0;
  const daysUntilDueDate = exactDueDate
    ? getDaysUntilDueDate(exactDueDate, props.baby.timeZone)
    : 0;
  const meta = STATUS_META[props.currentStatus.type];
  const isBorn = props.currentStatus.type === "born";
  const sublineKey =
    props.currentStatus.type === "labor_started" &&
    !getMilestonePolicy(props.baby).visibility.showHospital
      ? "Things are happening!"
      : meta.sublineKey;

  return (
    <div className="flex flex-col items-center py-8">
      <PhotoAvatar
        publicId={props.publicId}
        babyName={props.baby.name}
        photoUrl={props.photoUrl}
        thumbnailUrl={props.thumbnailUrl}
        blurDataUrl={props.blurDataUrl}
        fallbackEmoji={meta.emoji}
        variant={isBorn ? "born" : "default"}
      />

      <h2 className="text-4xl md:text-5xl font-black tracking-tight text-primary text-balance">
        {t(meta.answerKey)}
      </h2>
      <p className="mt-3 text-lg font-bold text-muted-foreground">{t(sublineKey)}</p>

      {props.currentStatus.type !== "not_yet" && (
        <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-muted/60 px-4 py-1.5 text-sm font-semibold text-muted-foreground">
          {isBorn
            ? t("Born")
            : props.currentStatus.type === "labor_started"
              ? t("Started")
              : t("Since")}{" "}
          {formatDate(props.currentStatus.date, {
            locale,
            timeZone: props.baby.timeZone,
          })}{" "}
          ({getRelativeTime(props.currentStatus.date, locale)})
        </p>
      )}

      {showDueDateBox ? (
        <div
          className={`mt-6 rotate-[-2deg] rounded-3xl border-2 px-8 py-5 pop-shadow ${
            !isMessageMode && overdueDays > 0
              ? "border-primary/40 bg-primary/10"
              : "border-border bg-card"
          }`}
        >
          <p
            className={`text-2xl font-black ${
              !isMessageMode && overdueDays > 0 ? "text-primary" : "text-foreground"
            }`}
          >
            {isMessageMode
              ? publicDueDateText
              : overdueDays > 0
                ? t(overdueDays === 1 ? "{{count}} day overdue" : "{{count}} days overdue", {
                    count: overdueDays,
                  })
                : t(
                    daysUntilDueDate === 1
                      ? "{{count}} day until due date"
                      : "{{count}} days until due date",
                    { count: daysUntilDueDate },
                  )}
          </p>
          {!isMessageMode ? (
            <p className="mt-1 text-sm font-semibold text-muted-foreground">
              {t("Due date: {{date}}", {
                date: exactDueDate ? formatDueDate(exactDueDate, locale) : "",
              })}
            </p>
          ) : null}
        </div>
      ) : null}

      <LatestUpdateBox latestUpdate={props.latestUpdate} />
    </div>
  );
}
