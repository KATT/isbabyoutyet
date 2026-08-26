import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
import { useCoachmarkSnapshot } from "@/lib/use-coachmark-store";
import { useVisualViewportMetrics } from "./visual-viewport";

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
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-live="polite">
      <div
        className="motion-safe:animate-pulse absolute rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background transition-all duration-300"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      {snapshot.isMobile ? (
        <div
          className="pointer-events-auto fixed left-1/2 bottom-[calc(4rem+env(safe-area-inset-bottom)+var(--visual-viewport-bottom))] w-[calc(100dvw-1.5rem)] max-w-xs -translate-x-1/2 rounded-xl border border-primary/20 bg-popover p-4 text-sm shadow-xl ring-1 ring-foreground/10"
          style={visualViewport.style}
          role="dialog"
          aria-label={props.title}
        >
          <p className="mb-1 font-medium text-foreground">{props.title}</p>
          <p className="mb-3 text-sm leading-relaxed text-muted-foreground">{props.description}</p>
          <div className="flex justify-end">
            <Button className="min-h-11" variant="outline" onClick={dismiss}>
              {props.completeOnDismiss ? t("Got it") : t("Hide tip")}
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "pointer-events-auto absolute w-72 rounded-xl border border-primary/20 bg-popover p-3 text-sm shadow-xl ring-1 ring-foreground/10",
            snapshot.placement === "above" && "-translate-y-full",
          )}
          style={{ top: tipTop, left: tipLeft }}
          role="dialog"
          aria-label={props.title}
        >
          <p className="mb-1 font-medium text-foreground">{props.title}</p>
          <p className="mb-3 text-xs leading-relaxed text-muted-foreground">{props.description}</p>
          <div className="flex justify-end">
            <Button size="sm" className="min-h-11" variant="ghost" onClick={dismiss}>
              {props.completeOnDismiss ? t("Got it") : t("Hide tip")}
            </Button>
          </div>
        </div>
      )}
    </div>,
    document.body,
  );
}
