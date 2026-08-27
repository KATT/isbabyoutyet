import * as stylex from "@stylexjs/stylex";
import { Link } from "@tanstack/react-router";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getMilestonePolicy } from "@workspace/convex/src/types";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Text } from "@workspace/ui-patterns/components/text";
import {
  formatDate,
  getOverdueDays,
  getDaysUntilDueDate,
  getRelativeTime,
  formatDueDate,
} from "./utils";
import { useI18n } from "@/lib/i18n";
import { useBabyPhotoOverlayNav } from "@/lib/overlay-nav";
import { BlurImage } from "@/components/blur-image";

const styles = stylex.create({
  root: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    paddingBlock: spacing.s8,
  },
  avatar: {
    alignItems: "center",
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "4px",
    display: "inline-flex",
    height: {
      "@media (min-width: 768px)": "8rem",
      default: "7rem",
    },
    justifyContent: "center",
    marginBottom: spacing.s6,
    overflow: "hidden",
    width: {
      "@media (min-width: 768px)": "8rem",
      default: "7rem",
    },
  },
  avatarDefault: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 25%, transparent)`,
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
  },
  avatarBorn: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderColor: colors.primary,
    boxShadow: `6px 6px 0 0 color-mix(in oklab, ${colors.primary} 30%, transparent)`,
  },
  avatarLink: {
    boxShadow: {
      ":focus-visible": `0 0 0 2px ${colors.background}, 0 0 0 4px ${colors.primary}`,
      default: null,
    },
    cursor: "pointer",
    outline: "none",
    textDecoration: "none",
    transform: {
      ":hover": "scale(1.05) rotate(-2deg)",
      default: null,
    },
    transitionDuration: "150ms",
    transitionProperty: "transform",
  },
  avatarEmoji: {
    fontSize: {
      "@media (min-width: 768px)": "4.5rem",
      default: "3.75rem",
    },
    lineHeight: 1,
  },
  answer: {
    color: colors.primary,
    fontSize: {
      "@media (min-width: 768px)": "3rem",
      default: "2.25rem",
    },
    fontWeight: 900,
    letterSpacing: "-0.025em",
    margin: 0,
    textWrap: "balance",
  },
  subline: {
    marginTop: spacing.s3,
  },
  sinceChip: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.muted} 60%, transparent)`,
    borderRadius: "9999px",
    color: colors.mutedForeground,
    display: "inline-flex",
    fontSize: "0.875rem",
    fontWeight: 600,
    gap: spacing.s1_5,
    marginTop: spacing.s3,
    paddingBlock: spacing.s1_5,
    paddingInline: spacing.s4,
  },
  dueBox: {
    borderRadius: "1.5rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    marginTop: spacing.s6,
    paddingBlock: spacing.s5,
    paddingInline: spacing.s8,
    transform: "rotate(-2deg)",
  },
  dueBoxDefault: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  dueBoxOverdue: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 40%, transparent)`,
  },
  dueHeadline: {
    fontSize: "1.5rem",
    fontWeight: 900,
    margin: 0,
  },
  dueHeadlineDefault: {
    color: colors.foreground,
  },
  dueHeadlineOverdue: {
    color: colors.primary,
  },
  dueSub: {
    marginTop: spacing.s1,
  },
  latestBox: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderBottomLeftRadius: "0.5rem",
    borderColor: `color-mix(in oklab, ${colors.primary} 25%, transparent)`,
    borderRadius: "1.5rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    marginTop: spacing.s8,
    maxWidth: "28rem",
    paddingBlock: spacing.s5,
    paddingInline: spacing.s6,
    textAlign: "left",
    transform: "rotate(-1deg)",
    width: "100%",
  },
  latestLabel: {
    color: `color-mix(in oklab, ${colors.primary} 80%, transparent)`,
    fontSize: "0.75rem",
    fontWeight: 900,
    letterSpacing: "0.1em",
    margin: 0,
    textTransform: "uppercase",
  },
  latestMessage: {
    color: colors.foreground,
    fontSize: "1.125rem",
    fontWeight: 700,
    lineHeight: 1.375,
    margin: 0,
    marginTop: spacing.s2,
    overflowWrap: "break-word",
  },
  latestMeta: {
    marginTop: spacing.s2,
  },
});

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
  const photo = useBabyPhotoOverlayNav(props.publicId ?? "");
  const variantStyle = props.variant === "born" ? styles.avatarBorn : styles.avatarDefault;

  // Use thumbnail for avatar, fallback to full photo if thumbnail not available
  const avatarImageUrl = props.thumbnailUrl ?? props.photoUrl;

  if (!avatarImageUrl && !props.photoUrl) {
    return (
      <div {...stylex.props(styles.avatar, variantStyle)}>
        <span {...stylex.props(styles.avatarEmoji)} aria-hidden="true">
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
      objectFit="cover"
    />
  ) : null;

  if (props.photoUrl && props.publicId) {
    return (
      <Link
        {...photo.openLink}
        aria-label={t("Photo of {{name}}", { name: props.babyName })}
        {...stylex.props(styles.avatar, variantStyle, styles.avatarLink)}
      >
        {avatarImage}
      </Link>
    );
  }

  return <div {...stylex.props(styles.avatar, variantStyle)}>{avatarImage}</div>;
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
    <div {...stylex.props(styles.latestBox)}>
      <p {...stylex.props(styles.latestLabel)}>{t("Latest from the family")} 💬</p>
      <p {...stylex.props(styles.latestMessage)}>{latestUpdate.message}</p>
      <div {...stylex.props(styles.latestMeta)}>
        <Text as="p" size="xs" weight="semibold" tone="muted">
          {t("Updated {{relative}}", {
            relative: getRelativeTime(new Date(latestUpdate.postedAt).toISOString(), locale),
          })}
        </Text>
      </div>
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
  const isOverdue = !isMessageMode && overdueDays > 0;

  return (
    <div {...stylex.props(styles.root)}>
      <PhotoAvatar
        publicId={props.publicId}
        babyName={props.baby.name}
        photoUrl={props.photoUrl}
        thumbnailUrl={props.thumbnailUrl}
        blurDataUrl={props.blurDataUrl}
        fallbackEmoji={meta.emoji}
        variant={isBorn ? "born" : "default"}
      />

      <h2 {...stylex.props(styles.answer)}>{t(meta.answerKey)}</h2>
      <div {...stylex.props(styles.subline)}>
        <Text as="p" size="lg" weight="bold" tone="muted">
          {t(sublineKey)}
        </Text>
      </div>

      {props.currentStatus.type !== "not_yet" && (
        <p {...stylex.props(styles.sinceChip)}>
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
          {...stylex.props(styles.dueBox, isOverdue ? styles.dueBoxOverdue : styles.dueBoxDefault)}
        >
          <p
            {...stylex.props(
              styles.dueHeadline,
              isOverdue ? styles.dueHeadlineOverdue : styles.dueHeadlineDefault,
            )}
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
            <div {...stylex.props(styles.dueSub)}>
              <Text as="p" size="sm" weight="semibold" tone="muted">
                {t("Due date: {{date}}", {
                  date: exactDueDate ? formatDueDate(exactDueDate, locale) : "",
                })}
              </Text>
            </div>
          ) : null}
        </div>
      ) : null}

      <LatestUpdateBox latestUpdate={props.latestUpdate} />
    </div>
  );
}
