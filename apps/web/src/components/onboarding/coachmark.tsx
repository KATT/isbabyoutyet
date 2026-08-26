import { Button } from "@workspace/ui/components/button";
import { cn } from "@workspace/ui/lib/utils";
import { useRef, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { useI18n } from "@/lib/i18n";
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
  isMobile: boolean;
};

function mobileMediaQuery() {
  if (typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia("(max-width: 767px)");
}

function createCoachmarkStore(opts: { targetId: string; onDismiss: () => void }) {
  let snapshot: CoachmarkSnapshot | null = null;

  return {
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => {
      let target: HTMLElement | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let scrolledTarget: HTMLElement | null = null;
      const mediaQuery = mobileMediaQuery();

      function onTargetClick() {
        opts.onDismiss();
      }

      function resolveTarget() {
        const element = document.querySelector(`[data-tour-id="${opts.targetId}"]`);
        const nextTarget = element instanceof HTMLElement ? element : null;
        if (target === nextTarget) return target;
        if (target) {
          target.removeEventListener("click", onTargetClick);
        }
        resizeObserver?.disconnect();
        target = nextTarget;
        if (target && typeof ResizeObserver !== "undefined") {
          resizeObserver = new ResizeObserver(measure);
          resizeObserver.observe(target);
        }
        if (target) {
          target.addEventListener("click", onTargetClick);
        }
        if (target && scrolledTarget !== target) {
          scrolledTarget = target;
          target.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
        }
        return target;
      }

      function measure() {
        const currentTarget = resolveTarget();
        if (!currentTarget) {
          if (snapshot !== null) {
            snapshot = null;
            notify();
          }
          return;
        }
        const rect = currentTarget.getBoundingClientRect();
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
          isMobile: mediaQuery?.matches === true,
        };
        if (
          snapshot?.rect.top === next.rect.top &&
          snapshot.rect.left === next.rect.left &&
          snapshot.rect.width === next.rect.width &&
          snapshot.rect.height === next.rect.height &&
          snapshot.placement === next.placement &&
          snapshot.viewportWidth === next.viewportWidth &&
          snapshot.isMobile === next.isMobile
        ) {
          return;
        }
        snapshot = next;
        notify();
      }

      measure();
      window.addEventListener("resize", measure);
      window.addEventListener("scroll", measure, true);
      mediaQuery?.addEventListener("change", measure);
      const interval = window.setInterval(measure, 500);
      const mutationObserver =
        typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
      mutationObserver?.observe(document.body, { childList: true, subtree: true });

      return () => {
        window.removeEventListener("resize", measure);
        window.removeEventListener("scroll", measure, true);
        mediaQuery?.removeEventListener("change", measure);
        target?.removeEventListener("click", onTargetClick);
        resizeObserver?.disconnect();
        mutationObserver?.disconnect();
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
  return <CoachmarkTarget key={props.targetId} {...props} />;
}

function CoachmarkTarget(props: CoachmarkProps) {
  const { t } = useI18n();
  const visualViewport = useVisualViewportMetrics();
  const storeRef = useRef<ReturnType<typeof createCoachmarkStore> | null>(null);
  if (!storeRef.current) {
    storeRef.current = createCoachmarkStore({
      targetId: props.targetId,
      onDismiss: props.onDismiss,
    });
  }
  const store = storeRef.current;
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
