import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useMemo, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";

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

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type CoachmarkSnapshot = {
  rect: Rect;
  placement: "above" | "below";
  viewportWidth: number;
};

function createCoachmarkStore(targetId: string) {
  let snapshot: CoachmarkSnapshot | null = null;

  return {
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => {
      const element = document.querySelector(`[data-tour-id="${targetId}"]`);
      if (!(element instanceof HTMLElement)) {
        return () => undefined;
      }
      const target = element;

      function measure() {
        const rect = target.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) {
          if (snapshot !== null) {
            snapshot = null;
            notify();
          }
          return;
        }
        const next = {
          rect: { top: rect.top, left: rect.left, width: rect.width, height: rect.height },
          placement:
            window.innerHeight - rect.bottom < 160 ? ("above" as const) : ("below" as const),
          viewportWidth: window.innerWidth,
        };
        if (
          snapshot?.rect.top === next.rect.top &&
          snapshot.rect.left === next.rect.left &&
          snapshot.rect.width === next.rect.width &&
          snapshot.rect.height === next.rect.height &&
          snapshot.placement === next.placement &&
          snapshot.viewportWidth === next.viewportWidth
        ) {
          return;
        }
        snapshot = next;
        notify();
      }

      target.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      const resizeObserver =
        typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
      resizeObserver?.observe(target);
      const interval = window.setInterval(measure, 500);

      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
        resizeObserver?.disconnect();
        window.clearInterval(interval);
      };
    },
  };
}

/**
 * Soft spotlight + tip bubble anchored to `[data-tour-id=…]`.
 * Skippable; does not block the whole page (pointer-events only on the tip).
 */
export function Coachmark(props: CoachmarkProps) {
  const { t } = useI18n();
  const store = useMemo(() => createCoachmarkStore(props.targetId), [props.targetId]);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);

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

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[45]" aria-live="polite">
      <div
        className="absolute rounded-xl ring-2 ring-primary/70 ring-offset-2 ring-offset-background transition-all duration-300 animate-pulse"
        style={{
          top: rect.top - 4,
          left: rect.left - 4,
          width: rect.width + 8,
          height: rect.height + 8,
        }}
      />
      <div
        className={cn(
          "pointer-events-auto absolute w-72 rounded-xl border border-primary/20 bg-popover p-3 text-sm shadow-xl ring-1 ring-foreground/10",
          snapshot.placement === "above" && "-translate-y-full",
        )}
        style={{ top: tipTop, left: tipLeft }}
        role="status"
      >
        <p className="font-medium text-foreground mb-1">{props.title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed mb-3">{props.description}</p>
        <div className="flex justify-end gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              if (props.completeOnDismiss) {
                props.onComplete?.();
              }
              props.onDismiss();
            }}
          >
            {props.completeOnDismiss ? t("Got it") : t("Hide tip")}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
