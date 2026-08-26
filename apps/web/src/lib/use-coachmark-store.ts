import { useState, useSyncExternalStore } from "react";

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
 * Subscribes to the coachmark target’s layout. Store init lives in lib
 * (useState) so feature UI avoids both useState and render-time ref access.
 */
export function useCoachmarkSnapshot(opts: { targetId: string; onDismiss: () => void }) {
  const [store] = useState(() =>
    createCoachmarkStore({
      targetId: opts.targetId,
      onDismiss: opts.onDismiss,
    }),
  );
  return useSyncExternalStore(store.subscribe, store.getSnapshot, () => null);
}
