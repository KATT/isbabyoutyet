import { useState, useSyncExternalStore } from "react";

/**
 * Connects an IntersectionObserver event directly to an action while React
 * owns subscription setup and cleanup through useSyncExternalStore.
 */
export function useIntersectionAction(opts: {
  enabled: boolean;
  onIntersect: () => void;
  threshold: number;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  function subscribe(_notify: () => void) {
    if (!opts.enabled || node === null || typeof IntersectionObserver === "undefined") {
      return () => undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          opts.onIntersect();
        }
      },
      { threshold: opts.threshold },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }
  useSyncExternalStore(
    subscribe,
    () => 0,
    () => 0,
  );
  return setNode;
}
