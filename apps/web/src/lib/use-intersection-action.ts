import { useCallback, useState, useSyncExternalStore } from "react";

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
  const subscribe = useCallback(
    (_notify: () => void) => {
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
    },
    [node, opts.enabled, opts.onIntersect, opts.threshold],
  );
  useSyncExternalStore(
    subscribe,
    () => 0,
    () => 0,
  );
  return setNode;
}
