import { Button } from "@workspace/ui/components/button";
import { createPortal } from "react-dom";
import * as stylex from "@stylexjs/stylex";
import { colors, spacing } from "@workspace/ui/lib/tokens.stylex";
import { Stack } from "@workspace/ui-patterns/components/stack";
import { Text } from "@workspace/ui-patterns/components/text";
import { Inline } from "@workspace/ui-patterns/components/inline";
import { useI18n } from "@/lib/i18n";
import { useCoachmarkSnapshot } from "@/lib/use-coachmark-store";
import { useVisualViewportMetrics } from "@/lib/use-visual-viewport";

type CoachmarkProps = {
  /** Matches `data-tour-id` on the highlighted element */
  targetId: string;
  title: string;
  description: string;
  onDismiss: () => void;
  /** When true, dismissing also completes the step */
  completeOnDismiss: boolean | undefined;
  onComplete: (() => void) | undefined;
};

const pulse = stylex.keyframes({
  "0%, 100%": { opacity: 1 },
  "50%": { opacity: 0.55 },
});

const styles = stylex.create({
  overlay: {
    pointerEvents: "none",
    position: "fixed",
    inset: 0,
    zIndex: 45,
  },
  spotlight: {
    position: "absolute",
    borderRadius: "0.75rem",
    boxShadow: `0 0 0 2px color-mix(in oklab, ${colors.primary} 70%, transparent)`,
    outline: `2px solid ${colors.background}`,
    outlineOffset: 2,
    transition: "all 0.3s ease",
    "@media (prefers-reduced-motion: no-preference)": {
      animationName: pulse,
      animationDuration: "2s",
      animationIterationCount: "infinite",
    },
  },
  tip: {
    pointerEvents: "auto",
    borderRadius: "0.75rem",
    borderWidth: 1,
    borderStyle: "solid",
    borderColor: `color-mix(in oklab, ${colors.primary} 20%, transparent)`,
    backgroundColor: colors.popover,
    padding: spacing.s4,
    fontSize: "0.875rem",
    lineHeight: "1.25rem",
    boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
    outline: `1px solid color-mix(in oklab, ${colors.foreground} 10%, transparent)`,
  },
  tipMobile: {
    position: "fixed",
    left: "50%",
    bottom: "calc(4rem + env(safe-area-inset-bottom) + var(--visual-viewport-bottom, 0px))",
    width: "calc(100dvw - 1.5rem)",
    maxWidth: "20rem",
    transform: "translateX(-50%)",
  },
  tipDesktop: {
    position: "absolute",
    width: "18rem",
    padding: spacing.s3,
  },
  tipDesktopAbove: {
    transform: "translateY(-100%)",
  },
});

/**
 * Soft spotlight + tip bubble anchored to `[data-tour-id=…]`.
 * Skippable; does not block the whole page (pointer-events only on the tip).
 */
export function Coachmark(props: CoachmarkProps) {
  return <CoachmarkTarget key={props.targetId} {...props} />;
}

function CoachmarkTarget(props: CoachmarkProps) {
  const { t } = useI18n();
  const visualViewport = useVisualViewportMetrics();
  const snapshot = useCoachmarkSnapshot({
    targetId: props.targetId,
    onDismiss: props.onDismiss,
  });

  if (!snapshot || typeof document === "undefined") {
    return null;
  }

  const rect = snapshot.rect;
  const tipTop =
    snapshot.placement === "below" ? rect.top + rect.height + 12 : Math.max(8, rect.top - 12);
  const tipLeft = Math.min(
    Math.max(12, rect.left + rect.width / 2 - 140),
    snapshot.viewportWidth - 292,
  );

  function dismiss() {
    if (props.completeOnDismiss) {
      props.onComplete?.();
    }
    props.onDismiss();
  }

  return createPortal(
    <div {...stylex.props(styles.overlay)} aria-live="polite">
      <div
        {...stylex.props(styles.spotlight)}
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      {snapshot.isMobile ? (
        <div
          {...stylex.props(styles.tip, styles.tipMobile)}
          style={visualViewport.style}
          role="dialog"
          aria-label={props.title}
          data-coachmark-tip="mobile"
        >
          <Stack gap="s3">
            <Text weight="medium">{props.title}</Text>
            <Text size="sm" tone="muted">
              {props.description}
            </Text>
            <Inline justify="end">
              <Button touchTarget variant="outline" onClick={dismiss}>
                {props.completeOnDismiss ? t("Got it") : t("Hide tip")}
              </Button>
            </Inline>
          </Stack>
        </div>
      ) : (
        <div
          {...stylex.props(
            styles.tip,
            styles.tipDesktop,
            snapshot.placement === "above" ? styles.tipDesktopAbove : null,
          )}
          style={{ top: tipTop, left: tipLeft }}
          role="dialog"
          aria-label={props.title}
          data-coachmark-tip="desktop"
        >
          <Stack gap="s3">
            <Text weight="medium">{props.title}</Text>
            <Text size="xs" tone="muted">
              {props.description}
            </Text>
            <Inline justify="end">
              <Button size="sm" touchTarget variant="ghost" onClick={dismiss}>
                {props.completeOnDismiss ? t("Got it") : t("Hide tip")}
              </Button>
            </Inline>
          </Stack>
        </div>
      )}
    </div>,
    document.body,
  );
}
