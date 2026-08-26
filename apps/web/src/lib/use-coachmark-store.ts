import { useRef, useState, useSyncExternalStore } from "react";

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

function createCoachmarkStore(opts: { targetId: string; onDismissRef: { current: () => void } }) {
  let snapshot: CoachmarkSnapshot | null = null;

  return {
    getSnapshot: () => snapshot,
    subscribe: (notify: () => void) => {
      let target: HTMLElement | null = null;
      let resizeObserver: ResizeObserver | null = null;
      let scrolledTarget: HTMLElement | null = null;
      const mediaQuery = mobileMediaQuery();

      function onTargetClick() {
        opts.onDismissRef.current();
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
        const nextTarget = resolveTarget();
        if (!nextTarget) {
          if (snapshot !== null) {
            snapshot = null;
            notify();
          }
          return;
        }
        const nextRect = nextTarget.getBoundingClientRect();
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        const placement: "above" | "below" =
          nextRect.bottom + 160 > viewportHeight && nextRect.top > 160 ? "above" : "below";
        const isMobile = mediaQuery?.matches ?? viewportWidth < 768;
        const next: CoachmarkSnapshot = {
          rect: {
            top: nextRect.top,
            left: nextRect.left,
            width: nextRect.width,
            height: nextRect.height,
          },
          placement,
          viewportWidth,
          isMobile,
        };
        const previous = snapshot;
        if (
          previous &&
          previous.placement === next.placement &&
          previous.viewportWidth === next.viewportWidth &&
          previous.isMobile === next.isMobile &&
          previous.rect.top === next.rect.top &&
          previous.rect.left === next.rect.left &&
          previous.rect.width === next.rect.width &&
          previous.rect.height === next.rect.height
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
 * Subscribes to the coachmark target’s layout. Store init lives in lib
 * (useState) so feature UI avoids both useState and render-time ref access.
 * `onDismiss` is read through a ref so callers may pass a fresh closure.
 */
export function useCoachmarkSnapshot(opts: { targetId: string; onDismiss: () => void }) {
  const onDismissRef = useRef(opts.onDismiss);
  onDismissRef.current = opts.onDismiss;
  const [store] = useState(() =>
    createCoachmarkStore({
      targetId: opts.targetId,
      onDismissRef,
    }),
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}
