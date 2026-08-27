import { Link } from "@tanstack/react-router";
import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getMilestonePolicy } from "@workspace/convex/src/types";
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
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

type PhotoAvatarProps = {
  publicId: string | null;
  babyName: string;
  photoUrl: string | null;
  thumbnailUrl: string | null;
  blurDataUrl: string | null;
  fallbackEmoji: string;
  variant: "default" | "born";
};

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
    cursor: "pointer",
    transition: "transform 0.15s",
    ":hover": { transform: "scale(1.05) rotate(-2deg)" },
    ":focus": {
      outline: `2px solid ${colors.primary}`,
      outlineOffset: "2px",
    },
  },
  emoji: {
    fontSize: {
      "@media (min-width: 768px)": "4.5rem",
      default: "3.75rem",
    },
  },
  photo: {
    height: "100%",
    objectFit: "cover",
    width: "100%",
  },
  headline: {
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
    color: colors.mutedForeground,
    fontSize: "1.125rem",
    fontWeight: 700,
    margin: 0,
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
  dueBoxOverdue: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 40%, transparent)`,
  },
  dueBoxNormal: {
    backgroundColor: colors.card,
    borderColor: colors.border,
  },
  latest: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 25%, transparent)`,
    borderRadius: "1.5rem",
    borderBottomLeftRadius: "0.5rem",
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
});

function PhotoAvatar(props: PhotoAvatarProps) {
  const { t } = useI18n();
  const photo = useBabyPhotoOverlayNav(props.publicId ?? "");
  const variantStyle = props.variant === "born" ? styles.avatarBorn : styles.avatarDefault;
  const avatarImageUrl = props.thumbnailUrl ?? props.photoUrl;
  const photoSx = stylex.props(styles.photo);

  if (!avatarImageUrl && !props.photoUrl) {
    return (
      <div {...stylex.props(styles.avatar, variantStyle)}>
        <span {...stylex.props(styles.emoji)} aria-hidden="true">
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
      className={photoSx.className}
      style={{ ...photoSx.style, objectFit: "cover" }}
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
    <div {...stylex.props(styles.latest)}>
      <Text size="xs" weight="black" tone="primary">
        {t("Latest from the family")} 💬
      </Text>
      <Text size="lg" weight="bold">
        {latestUpdate.message}
      </Text>
      <Text size="xs" weight="semibold" tone="muted">
        {t("Updated {{relative}}", {
          relative: getRelativeTime(new Date(latestUpdate.postedAt).toISOString(), locale),
        })}
      </Text>
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

      <h2 {...stylex.props(styles.headline)}>{t(meta.answerKey)}</h2>
      <p {...stylex.props(styles.subline)}>{t(sublineKey)}</p>

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
          {...stylex.props(
            styles.dueBox,
            !isMessageMode && overdueDays > 0 ? styles.dueBoxOverdue : styles.dueBoxNormal,
          )}
        >
          <Text
            size="2xl"
            weight="black"
            tone={!isMessageMode && overdueDays > 0 ? "primary" : "foreground"}
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
          </Text>
          {!isMessageMode ? (
            <Text size="sm" weight="semibold" tone="muted">
              {t("Due date: {{date}}", {
                date: exactDueDate ? formatDueDate(exactDueDate, locale) : "",
              })}
            </Text>
          ) : null}
        </div>
      ) : null}

      <LatestUpdateBox latestUpdate={props.latestUpdate} />
    </div>
  );
}
