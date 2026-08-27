import type { BabyData, BabyStatus } from "@workspace/convex/src/types";
import { getMilestonePolicy, MILESTONE_FIELDS } from "@workspace/convex/src/types";
import { getRelativeTime } from "./utils";
import { useI18n } from "@/lib/i18n";
import { MILESTONE_LABEL_KEYS } from "./translation-keys";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";

type ProgressIndicatorProps = {
  baby: BabyData;
  currentStatus: BabyStatus;
};

const styles = stylex.create({
  root: { overflowX: "clip", width: "100%" },
  grid: { display: "grid" },
  step: {
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    textAlign: "center",
  },
  rail: {
    alignItems: "center",
    display: "flex",
    marginBottom: spacing.s1_5,
    width: "100%",
  },
  halfLine: { borderTopWidth: "2px", flexGrow: 1, height: 0, minWidth: 0 },
  halfTransparent: { borderColor: "transparent", borderStyle: "solid" },
  halfFilled: { borderColor: colors.primary, borderStyle: "solid" },
  halfEmpty: { borderColor: colors.border, borderStyle: "dashed" },
  badge: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: "9999px",
    borderStyle: "solid",
    borderWidth: "2px",
    display: "flex",
    flexShrink: 0,
    fontSize: "1.125rem",
    height: "2.5rem",
    justifyContent: "center",
    position: "relative",
    transition: "all 0.3s",
    width: "2.5rem",
  },
  badgeDone: {
    borderColor: colors.primary,
    boxShadow: `4px 4px 0 0 color-mix(in oklab, ${colors.primary} 18%, transparent)`,
  },
  badgeCurrent: {
    borderColor: `color-mix(in oklab, ${colors.primary} 40%, transparent)`,
    boxShadow: `0 0 0 2px color-mix(in oklab, ${colors.primary} 15%, transparent)`,
  },
  badgeIdle: { borderColor: colors.border, filter: "grayscale(1)", opacity: 0.6 },
  glow: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    borderRadius: "9999px",
    inset: 0,
    pointerEvents: "none",
    position: "absolute",
  },
  emoji: { position: "relative" },
  dateChip: {
    backgroundColor: `color-mix(in oklab, ${colors.muted} 60%, transparent)`,
    borderRadius: "9999px",
    color: colors.mutedForeground,
    fontSize: "10px",
    fontWeight: 600,
    marginTop: spacing.s1,
    maxWidth: "100%",
    overflow: "hidden",
    paddingBlock: spacing.s0_5,
    paddingInline: spacing.s1_5,
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  label: {
    fontSize: "11px",
    fontWeight: 800,
    lineHeight: 1.25,
    textWrap: "balance",
    "@media (min-width: 640px)": { fontSize: "0.75rem" },
  },
  labelDone: { color: colors.foreground },
  labelCurrent: { color: colors.primary },
  labelIdle: { color: colors.mutedForeground },
});

export function ProgressIndicator(props: ProgressIndicatorProps) {
  const { locale, t } = useI18n();
  const baby = props.baby;
  const currentStatus = props.currentStatus;
  const milestonePolicy = getMilestonePolicy(baby);

  const stepMeta = {
    labor_started: { labelKey: MILESTONE_LABEL_KEYS.labor_started, emoji: "💫" },
    gone_to_hospital: { labelKey: MILESTONE_LABEL_KEYS.gone_to_hospital, emoji: "🏥" },
    born: { labelKey: MILESTONE_LABEL_KEYS.born, emoji: "🎉" },
  } as const;
  const steps = milestonePolicy.visibleMilestones.map((milestone) => ({
    key: milestone,
    ...stepMeta[milestone],
    date: baby[MILESTONE_FIELDS[milestone].date],
    completed: milestonePolicy.isReached(milestone),
  }));

  const lastIndex = steps.length - 1;

  return (
    <div
      {...stylex.props(styles.root)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(milestonePolicy.progressPercent)}
    >
      <ol
        {...stylex.props(styles.grid)}
        style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}
      >
        {steps.map((step, index) => {
          const isCurrent = currentStatus.type === step.key;
          const leftFilled = index > 0 && step.completed;
          const rightFilled = index < lastIndex && steps[index + 1]?.completed === true;

          return (
            <li key={step.key} {...stylex.props(styles.step)}>
              <div {...stylex.props(styles.rail)}>
                <div
                  aria-hidden="true"
                  {...stylex.props(
                    styles.halfLine,
                    index === 0
                      ? styles.halfTransparent
                      : leftFilled
                        ? styles.halfFilled
                        : styles.halfEmpty,
                  )}
                />
                <div
                  {...stylex.props(
                    styles.badge,
                    step.completed
                      ? styles.badgeDone
                      : isCurrent
                        ? styles.badgeCurrent
                        : styles.badgeIdle,
                  )}
                >
                  {step.completed && <span aria-hidden="true" {...stylex.props(styles.glow)} />}
                  <span aria-hidden="true" {...stylex.props(styles.emoji)}>
                    {step.emoji}
                  </span>
                </div>
                <div
                  aria-hidden="true"
                  {...stylex.props(
                    styles.halfLine,
                    index === lastIndex
                      ? styles.halfTransparent
                      : rightFilled
                        ? styles.halfFilled
                        : styles.halfEmpty,
                  )}
                />
              </div>
              <p
                {...stylex.props(
                  styles.label,
                  step.completed
                    ? styles.labelDone
                    : isCurrent
                      ? styles.labelCurrent
                      : styles.labelIdle,
                )}
              >
                {t(step.labelKey)}
              </p>
              {step.date && (
                <p {...stylex.props(styles.dateChip)}>{getRelativeTime(step.date, locale)}</p>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
