import { ArrowRight, CalendarHeart } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import { Badge } from "@workspace/ui/components/badge";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Text } from "@workspace/ui-patterns/components/text";
import { getCurrentStatus } from "@workspace/convex/src/types";
import type { BirthJourney } from "@workspace/convex/src/types";
import { formatDueDate, getDaysUntilDueDate, getOverdueDays } from "./utils";
import { useI18n } from "@/lib/i18n";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

type DashboardBabyCardBaby = {
  name: string;
  publicId: string;
  dueDate: string | null;
  dueDateDisplayMode: "exact" | "message";
  publicDueDateText: string | null;
  role: "owner" | "coParent";
  timeZone: string;
} & Partial<{
  laborStarted: string | null;
  wentToHospital: string | null;
  babyBorn: string | null;
  birthJourney: BirthJourney;
}>;

type DashboardBabyCardProps = {
  baby: DashboardBabyCardBaby;
  index: number;
  /** Coachmark target for the first-run tour */
  dataTourId: string | undefined;
};

const STATUS_EMOJI = {
  not_yet: "👶",
  labor_started: "💫",
  gone_to_hospital: "🏥",
  born: "🎉",
} as const;

const styles = stylex.create({
  card: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: "1.5rem",
    borderStyle: "solid",
    borderWidth: "2px",
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
    display: "flex",
    flexDirection: "column",
    gap: spacing.s4,
    height: "100%",
    padding: spacing.s6,
    transition: "transform 0.15s",
  },
  cardEven: {
    ":hover": { transform: "translateY(-0.25rem) rotate(-1deg)" },
  },
  cardOdd: {
    ":hover": { transform: "translateY(-0.25rem) rotate(1deg)" },
  },
  emoji: {
    alignItems: "center",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 10%, transparent)`,
    borderColor: `color-mix(in oklab, ${colors.primary} 25%, transparent)`,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    display: "flex",
    fontSize: "1.25rem",
    height: "3rem",
    justifyContent: "center",
    width: "3rem",
  },
  arrow: {
    color: colors.mutedForeground,
    height: "1rem",
    opacity: 0,
    transition: "opacity 0.15s",
    width: "1rem",
  },
  arrowVisible: {
    ":hover": { opacity: 1 },
  },
  link: {
    textDecoration: "none",
  },
  calIcon: {
    height: "0.875rem",
    width: "0.875rem",
  },
});

function StatusBadge(props: { baby: DashboardBabyCardBaby }) {
  const { t } = useI18n();
  const currentStatus = getCurrentStatus(props.baby);

  switch (currentStatus.type) {
    case "born":
      return <Badge>{t("Baby born")}</Badge>;
    case "labor_started":
      return <Badge>{t("Labour started")}</Badge>;
    case "gone_to_hospital":
      return <Badge>{t("Gone to hospital")}</Badge>;
    case "not_yet": {
      if (props.baby.dueDateDisplayMode === "message" || !props.baby.dueDate) {
        return <Badge variant="outline">{t("Not yet")}</Badge>;
      }
      const overdueDays = getOverdueDays(props.baby.dueDate, props.baby.timeZone);
      const daysUntilDueDate = getDaysUntilDueDate(props.baby.dueDate, props.baby.timeZone);
      if (overdueDays > 0) {
        return (
          <Badge>
            {t(overdueDays === 1 ? "{{count}} day overdue" : "{{count}} days overdue", {
              count: overdueDays,
            })}
          </Badge>
        );
      }
      if (daysUntilDueDate === 0) {
        return <Badge>{t("Due today!")}</Badge>;
      }
      return (
        <Badge variant="outline">
          {t(
            daysUntilDueDate === 1
              ? "{{count}} day until due date"
              : "{{count}} days until due date",
            { count: daysUntilDueDate },
          )}
        </Badge>
      );
    }
  }
}

export function DashboardBabyCard(props: DashboardBabyCardProps) {
  const { locale, t } = useI18n();
  const baby = props.baby;
  const currentStatus = getCurrentStatus(baby);
  const publicDueDateText = baby.publicDueDateText?.trim() ?? "";
  const dateLine =
    currentStatus.type === "born"
      ? t("Born {{date}}", { date: formatDueDate(currentStatus.date, locale) })
      : baby.dueDateDisplayMode === "message"
        ? publicDueDateText || t("Due date hidden")
        : t("Due {{date}}", {
            date: baby.dueDate ? formatDueDate(baby.dueDate, locale) : "",
          });

  return (
    <Link
      to="/baby/$publicId"
      params={{ publicId: baby.publicId }}
      {...stylex.props(styles.link)}
      data-tour-id={props.dataTourId}
    >
      <div
        {...stylex.props(
          styles.card,
          props.index % 2 === 0 ? styles.cardEven : styles.cardOdd,
        )}
      >
        <Inline gap="s3" justify="between" align="start" wrap={false}>
          <span {...stylex.props(styles.emoji)}>{STATUS_EMOJI[currentStatus.type]}</span>
          <ArrowRight {...stylex.props(styles.arrow)} />
        </Inline>
        <Text as="h2" size="2xl" weight="black">
          {baby.name}
        </Text>
        <Inline gap="s1_5" wrap={false}>
          <CalendarHeart {...stylex.props(styles.calIcon)} />
          <Text as="span" size="sm" weight="semibold" tone="muted">
            {dateLine}
          </Text>
        </Inline>
        <Inline gap="s2">
          {baby.role === "coParent" ? (
            <Badge variant="outline">{t("Shared with you")}</Badge>
          ) : null}
          <StatusBadge baby={baby} />
        </Inline>
      </div>
    </Link>
  );
}
