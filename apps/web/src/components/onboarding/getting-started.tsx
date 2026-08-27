import { Button } from "@workspace/ui/components/button";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@workspace/ui/components/drawer";
import { Progress, ProgressValue } from "@workspace/ui/components/progress";
import { CaretDown, CaretUp, Check, Sparkle, X } from "@phosphor-icons/react";
import { Link } from "@tanstack/react-router";
import type { LinkProps } from "@tanstack/react-router";
import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import type { TranslationFunction } from "@/lib/i18n";
import { useI18n } from "@/lib/i18n";
import { ONBOARDING_STEPS } from "./steps";
import { useVisualViewportMetrics } from "@/lib/use-visual-viewport";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { Text } from "@workspace/ui-patterns/components/text";
import { Box } from "@workspace/ui-patterns/components/box";

type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

type TourBaby = {
  publicId: string;
  name: string;
};

type GettingStartedCardProps = {
  effectiveSteps: string[];
  minimized: boolean;
  onMinimize: (minimized: boolean) => void;
  onDismiss: () => void;
  /** Current route context for CTAs */
  surface: "dashboard" | "baby";
  /** First owned baby — preferred deep-link target from dashboard CTAs only */
  tourBaby: TourBaby | null;
  /** Baby-page: scroll to and highlight a control */
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
};

type StepAction =
  | { kind: "link"; link: LinkProps; label: string; onClick: (() => void) | undefined }
  | { kind: "button"; onClick: () => void; label: string };

function babyPageLink(publicId: string): LinkProps {
  return {
    to: "/baby/$publicId",
    params: { publicId },
  };
}

function getStepAction(opts: {
  step: OnboardingStep;
  surface: "dashboard" | "baby";
  tourBaby: TourBaby | null;
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
  t: TranslationFunction;
}): StepAction | null {
  const step = opts.step;
  const t = opts.t;
  if (step.id === "add_baby") {
    if (opts.surface !== "dashboard") {
      return null;
    }
    const ctaLabel = step.ctaLabel;
    if (!ctaLabel) {
      return null;
    }
    return {
      kind: "link",
      link: { to: "/dashboard/add" },
      label: t(ctaLabel),
      onClick: undefined,
    };
  }

  if (opts.surface === "dashboard") {
    if (!opts.tourBaby) {
      return null;
    }
    const publicId = opts.tourBaby.publicId;
    const name = opts.tourBaby.name;
    // Preferred-baby deep link onto the page (not overlays). Highlight tips run on the baby surface.
    if (
      step.id === "share_link" ||
      step.id === "post_update" ||
      step.id === "explore_settings" ||
      step.id === "learn_encouragements"
    ) {
      return {
        kind: "link",
        link: babyPageLink(publicId),
        label: t("See {{name}}'s page", { name }),
        onClick: undefined,
      };
    }
    return null;
  }

  if (
    step.id === "share_link" ||
    step.id === "post_update" ||
    step.id === "explore_settings" ||
    step.id === "learn_encouragements"
  ) {
    return {
      kind: "button",
      onClick: () => opts.onGoToStep?.(step.id),
      label: t("Show me"),
    };
  }
  return null;
}

const fadeSlideIn = stylex.keyframes({
  from: { opacity: 0, transform: "translateY(0.5rem)" },
  to: { opacity: 1, transform: "translateY(0)" },
});

const styles = stylex.create({
  minimized: {
    position: "fixed",
    zIndex: 40,
    display: "flex",
    minHeight: "2.75rem",
    alignItems: "center",
    gap: spacing.s2,
    borderRadius: "9999px",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
    backgroundColor: `color-mix(in oklab, ${colors.popover} 95%, transparent)`,
    paddingInline: spacing.s3,
    paddingBlock: spacing.s2,
    fontSize: "0.875rem",
    fontWeight: 500,
    boxShadow: "0 10px 15px -3px rgb(0 0 0 / 0.1)",
    outline: `1px solid color-mix(in oklab, ${colors.foreground} 10%, transparent)`,
    backdropFilter: "blur(4px)",
    right: "calc(0.75rem + env(safe-area-inset-right) + max(0px, 100vw - 100dvw))",
    bottom: "calc(4rem + env(safe-area-inset-bottom) + var(--visual-viewport-bottom, 0px))",
    "@media (min-width: 640px)": { right: "1rem", bottom: "5rem" },
  },
  iconWellSm: {
    display: "flex",
    width: "1.75rem",
    height: "1.75rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    color: colors.primary,
  },
  iconWellMd: {
    display: "flex",
    width: "2.5rem",
    height: "2.5rem",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.75rem",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    color: colors.primary,
  },
  iconWellLg: {
    display: "flex",
    width: "2rem",
    height: "2rem",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.5rem",
    backgroundColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    color: colors.primary,
  },
  iconXs: { width: "0.875rem", height: "0.875rem" },
  iconSm: { width: "1rem", height: "1rem" },
  iconMd: { width: "1.25rem", height: "1.25rem" },
  iconCheckTiny: { width: "0.625rem", height: "0.625rem" },
  tabular: { fontVariantNumeric: "tabular-nums", color: colors.foreground },
  mutedIcon: { color: colors.mutedForeground },
  mobileAside: {
    position: "fixed",
    left: "calc(0.75rem + env(safe-area-inset-left))",
    bottom: "calc(4rem + env(safe-area-inset-bottom) + var(--visual-viewport-bottom, 0px))",
    zIndex: 40,
    width: "calc(100dvw - 1.5rem - env(safe-area-inset-left) - env(safe-area-inset-right))",
    borderRadius: "0.75rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    backgroundColor: `color-mix(in oklab, ${colors.popover} 95%, transparent)`,
    padding: spacing.s3,
    boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
    outline: `1px solid color-mix(in oklab, ${colors.foreground} 10%, transparent)`,
    backdropFilter: "blur(12px)",
    animationName: fadeSlideIn,
    animationDuration: "0.2s",
    "@media (min-width: 768px)": { display: "none" },
  },
  growMin: { minWidth: 0, flexGrow: 1 },
  desktopAside: {
    position: "fixed",
    right: "1rem",
    bottom: "5rem",
    zIndex: 40,
    display: "none",
    width: "min(100% - 2rem, 22rem)",
    borderRadius: "0.75rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in oklab, ${colors.border} 60%, transparent)`,
    backgroundColor: `color-mix(in oklab, ${colors.popover} 95%, transparent)`,
    padding: spacing.s4,
    boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)",
    outline: `1px solid color-mix(in oklab, ${colors.foreground} 10%, transparent)`,
    backdropFilter: "blur(12px)",
    animationName: fadeSlideIn,
    animationDuration: "0.2s",
    "@media (min-width: 768px)": { display: "block" },
  },
  drawerBody: { flexGrow: 1, overflowY: "auto", padding: spacing.s4, paddingTop: spacing.s3 },
  stepList: {
    margin: 0,
    marginBottom: spacing.s3,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: spacing.s1_5,
  },
  stepItem: { borderRadius: "0.5rem", fontSize: "0.875rem", lineHeight: "1.25rem" },
  stepItemNext: {
    backgroundColor: `color-mix(in oklab, ${colors.primary} 8%, transparent)`,
    outline: `1px solid color-mix(in oklab, ${colors.primary} 15%, transparent)`,
  },
  stepRow: {
    display: "flex",
    minHeight: "2.75rem",
    width: "100%",
    alignItems: "center",
    gap: spacing.s2,
    borderRadius: "0.5rem",
    paddingInline: spacing.s2,
    paddingBlock: spacing.s1_5,
    textAlign: "left",
    textDecoration: "none",
    color: "inherit",
    backgroundColor: "transparent",
    borderWidth: 0,
    cursor: "pointer",
    ":hover": { backgroundColor: `color-mix(in oklab, ${colors.primary} 6%, transparent)` },
  },
  checkCircle: {
    marginTop: "0.125rem",
    display: "flex",
    width: "1rem",
    height: "1rem",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "9999px",
    borderWidth: 1,
    borderStyle: "solid",
  },
  checkDone: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
    color: colors.primaryForeground,
  },
  checkTodo: { borderColor: `color-mix(in oklab, ${colors.mutedForeground} 30%, transparent)` },
  stepTitleDone: {
    lineHeight: 1.375,
    color: colors.mutedForeground,
    textDecorationLine: "line-through",
  },
  stepTitle: { lineHeight: 1.375 },
  nextHint: {
    display: "flex",
    flexDirection: "column",
    gap: spacing.s2,
    borderRadius: "0.5rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in oklab, ${colors.primary} 15%, transparent)`,
    backgroundColor: `color-mix(in oklab, ${colors.primary} 5%, transparent)`,
    padding: spacing.s3,
  },
  nextHintIcon: {
    marginTop: "0.125rem",
    width: "1rem",
    height: "1rem",
    flexShrink: 0,
    color: colors.primary,
  },
  progressSpacer: { marginTop: spacing.s3 },
  headerRow: { marginBottom: spacing.s3 },
  widthFull: { width: "100%" },
});

export function GettingStartedCard(props: GettingStartedCardProps) {
  const { t } = useI18n();
  const visualViewport = useVisualViewportMetrics();
  const done = new Set(props.effectiveSteps);
  const completedCount = ONBOARDING_STEPS.filter((step) => done.has(step.id)).length;
  const total = ONBOARDING_STEPS.length;
  const percent = Math.round((completedCount / total) * 100);
  const nextStep = ONBOARDING_STEPS.find((step) => !done.has(step.id));
  const allDone = !nextStep;
  const NextStepIcon = nextStep?.icon;

  if (props.minimized) {
    return (
      <button
        type="button"
        onClick={() => props.onMinimize(false)}
        {...stylex.props(styles.minimized)}
        style={visualViewport.style}
        aria-label={t("Getting started: {{completed}} of {{total}} done. Expand.", {
          completed: completedCount,
          total,
        })}
      >
        <span {...stylex.props(styles.iconWellSm)}>
          <Sparkle {...stylex.props(styles.iconXs)} />
        </span>
        <span {...stylex.props(styles.tabular)}>
          {completedCount}/{total}
        </span>
        <CaretUp {...stylex.props(styles.iconSm, styles.mutedIcon)} />
      </button>
    );
  }

  return (
    <>
      <Drawer showSwipeHandle>
        <aside
          {...stylex.props(styles.mobileAside)}
          style={visualViewport.style}
          aria-label={t("Getting started checklist")}
        >
          <Inline gap="s3" wrap={false} fullWidth>
            <span {...stylex.props(styles.iconWellMd)}>
              {NextStepIcon ? (
                <NextStepIcon {...stylex.props(styles.iconMd)} />
              ) : (
                <Check {...stylex.props(styles.iconMd)} />
              )}
            </span>
            <div {...stylex.props(styles.growMin)}>
              <Text size="xs" weight="medium" tone="muted">
                {t("Getting started")} · {completedCount}/{total}
              </Text>
              <Text size="sm" weight="semibold" truncate>
                {nextStep ? t(nextStep.title) : t("You're all set")}
              </Text>
            </div>
            <DrawerTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t("Getting started: {{completed}} of {{total}} done. Expand.", {
                    completed: completedCount,
                    total,
                  })}
                />
              }
            >
              <CaretUp />
            </DrawerTrigger>
          </Inline>
          <div {...stylex.props(styles.progressSpacer)}>
            <Progress value={percent} aria-label={t("Tour progress")} />
          </div>
        </aside>

        <DrawerContent>
          <DrawerHeader>
            <Inline gap="s3" align="start" wrap={false} fullWidth>
              <span {...stylex.props(styles.iconWellMd)}>
                <Sparkle {...stylex.props(styles.iconMd)} />
              </span>
              <div {...stylex.props(styles.growMin)}>
                <DrawerTitle>{t("Getting started")}</DrawerTitle>
                <DrawerDescription>
                  {allDone ? t("You're all set") : t("Tap a step to jump there")}
                </DrawerDescription>
              </div>
              <DrawerClose
                render={<Button variant="ghost" size="icon" aria-label={t("Close checklist")} />}
              >
                <X />
              </DrawerClose>
            </Inline>
          </DrawerHeader>
          <div {...stylex.props(styles.drawerBody)}>
            <ChecklistContents
              {...props}
              done={done}
              nextStep={nextStep}
              percent={percent}
              t={t}
              onBeforeAction={undefined}
              onRequestDismiss={props.onDismiss}
              showDismissAction={false}
              closeWithDrawerClose
            />
          </div>
          {nextStep ? (
            <DrawerFooter>
              <div {...stylex.props(styles.widthFull)}>
                <DrawerClose
                  render={<Button variant="secondary" touchTarget onClick={props.onDismiss} />}
                >
                  {t("Dismiss guide")}
                </DrawerClose>
              </div>
            </DrawerFooter>
          ) : null}
        </DrawerContent>
      </Drawer>

      <aside {...stylex.props(styles.desktopAside)} aria-label={t("Getting started checklist")}>
        <div {...stylex.props(styles.headerRow)}>
          <Inline gap="s2" justify="between" align="start" wrap={false} fullWidth>
            <Inline gap="s2" wrap={false}>
              <span {...stylex.props(styles.iconWellLg)}>
                <Sparkle {...stylex.props(styles.iconSm)} />
              </span>
              <Stack gap="s1">
                <Text size="sm" weight="semibold">
                  {t("Getting started")}
                </Text>
                <Text size="xs" tone="muted">
                  {allDone ? t("You're all set") : t("Tap a step to jump there")}
                </Text>
              </Stack>
            </Inline>
            <Button
              variant="ghost"
              size="icon-sm"
              aria-label={t("Minimize")}
              onClick={() => props.onMinimize(true)}
            >
              <CaretDown />
            </Button>
          </Inline>
        </div>
        <ChecklistContents
          {...props}
          done={done}
          nextStep={nextStep}
          percent={percent}
          t={t}
          onBeforeAction={undefined}
          onRequestDismiss={props.onDismiss}
          showDismissAction
          closeWithDrawerClose={false}
        />
      </aside>
    </>
  );
}

type ChecklistContentsProps = GettingStartedCardProps & {
  done: Set<string>;
  nextStep: OnboardingStep | undefined;
  percent: number;
  t: TranslationFunction;
  onBeforeAction: (() => void) | undefined;
  onRequestDismiss: () => void;
  showDismissAction: boolean;
  closeWithDrawerClose: boolean;
};

function ChecklistContents(props: ChecklistContentsProps) {
  const { t } = props;
  return (
    <>
      <Box padY="none">
        <Progress value={props.percent} aria-label={t("Tour progress")}>
          <ProgressValue />
        </Progress>
      </Box>

      <ul {...stylex.props(styles.stepList)}>
        {ONBOARDING_STEPS.map((step) => {
          const isDone = props.done.has(step.id);
          const isNext = props.nextStep?.id === step.id;
          const action = isDone
            ? null
            : getStepAction({
                step,
                surface: props.surface,
                tourBaby: props.tourBaby,
                onGoToStep: props.onGoToStep,
                t,
              });
          return (
            <li
              key={step.id}
              {...stylex.props(styles.stepItem, isNext ? styles.stepItemNext : null)}
            >
              <StepRow
                step={step}
                isDone={isDone}
                action={action}
                title={t(step.title)}
                onBeforeAction={props.onBeforeAction}
                closeWithDrawerClose={props.closeWithDrawerClose}
              />
            </li>
          );
        })}
      </ul>

      {props.nextStep ? (
        <>
          <NextStepHint
            step={props.nextStep}
            surface={props.surface}
            tourBaby={props.tourBaby}
            onGoToStep={props.onGoToStep}
            onBeforeAction={props.onBeforeAction}
            closeWithDrawerClose={props.closeWithDrawerClose}
            t={t}
          />
          {props.showDismissAction ? (
            <div {...stylex.props(styles.widthFull)}>
              <Button size="sm" variant="secondary" touchTarget onClick={props.onRequestDismiss}>
                {t("Dismiss guide")}
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <Stack gap="s2">
          <Text size="xs" tone="muted">
            {t("Nice work — share your page and enjoy the quiet inbox.")}
          </Text>
          <Button size="sm" variant="outline" onClick={props.onDismiss}>
            {t("Close checklist")}
          </Button>
        </Stack>
      )}
    </>
  );
}

function StepRow(props: {
  step: OnboardingStep;
  isDone: boolean;
  action: StepAction | null;
  title: string;
  onBeforeAction: (() => void) | undefined;
  closeWithDrawerClose: boolean;
}) {
  const inner = (
    <>
      <span
        {...stylex.props(styles.checkCircle, props.isDone ? styles.checkDone : styles.checkTodo)}
      >
        {props.isDone ? <Check {...stylex.props(styles.iconCheckTiny)} /> : null}
      </span>
      <span {...stylex.props(props.isDone ? styles.stepTitleDone : styles.stepTitle)}>
        {props.title}
      </span>
    </>
  );

  if (props.action?.kind === "link") {
    const action = props.action;
    const link = (
      <Link
        {...action.link}
        {...stylex.props(styles.stepRow)}
        aria-label={action.label}
        onClick={() => {
          if (props.onBeforeAction) {
            props.onBeforeAction();
          }
          if (action.onClick) {
            action.onClick();
          }
        }}
      >
        {inner}
      </Link>
    );
    if (props.closeWithDrawerClose) {
      return <DrawerClose render={link} nativeButton={false} />;
    }
    return link;
  }

  if (props.action?.kind === "button") {
    const action = props.action;
    const button = (
      <button
        type="button"
        {...stylex.props(styles.stepRow)}
        onClick={() => {
          if (props.onBeforeAction) {
            props.onBeforeAction();
          }
          action.onClick();
        }}
        aria-label={action.label}
      >
        {inner}
      </button>
    );
    if (props.closeWithDrawerClose) {
      return <DrawerClose render={button} />;
    }
    return button;
  }

  return <div {...stylex.props(styles.stepRow)}>{inner}</div>;
}

function NextStepHint(props: {
  step: OnboardingStep;
  surface: "dashboard" | "baby";
  tourBaby: TourBaby | null;
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
  onBeforeAction: (() => void) | undefined;
  closeWithDrawerClose: boolean;
  t: TranslationFunction;
}) {
  const { t } = props;
  const Icon = props.step.icon;
  const action = getStepAction({
    step: props.step,
    surface: props.surface,
    tourBaby: props.tourBaby,
    onGoToStep: props.onGoToStep,
    t,
  });

  return (
    <div {...stylex.props(styles.nextHint)} data-slot="next-step-hint">
      <Inline gap="s2" align="start" wrap={false}>
        <Icon {...stylex.props(styles.nextHintIcon)} />
        <Stack gap="s1">
          <Text size="sm" weight="medium">
            {t(props.step.title)}
          </Text>
          <Text size="xs" tone="muted">
            {t(props.step.description)}
          </Text>
        </Stack>
      </Inline>
      {action ? (
        <Inline gap="s2">
          <StepActionControl
            action={action}
            onBeforeAction={props.onBeforeAction}
            size="sm"
            closeWithDrawerClose={props.closeWithDrawerClose}
          />
        </Inline>
      ) : null}
    </div>
  );
}

function StepActionControl(props: {
  action: StepAction;
  onBeforeAction: (() => void) | undefined;
  size: "sm" | "default";
  closeWithDrawerClose: boolean;
}) {
  if (props.action.kind === "link") {
    const action = props.action;
    const button = (
      <Button
        size={props.size}
        touchTarget
        render={
          <Link
            {...action.link}
            onClick={() => {
              if (props.onBeforeAction) {
                props.onBeforeAction();
              }
              if (action.onClick) {
                action.onClick();
              }
            }}
          />
        }
        nativeButton={false}
      >
        {action.label}
      </Button>
    );
    if (props.closeWithDrawerClose) {
      return <DrawerClose render={button} nativeButton={false} />;
    }
    return button;
  }

  const action = props.action;
  const button = (
    <Button
      size={props.size}
      touchTarget
      onClick={() => {
        if (props.onBeforeAction) {
          props.onBeforeAction();
        }
        action.onClick();
      }}
    >
      {action.label}
    </Button>
  );
  if (props.closeWithDrawerClose) {
    return <DrawerClose render={button} />;
  }
  return button;
}
