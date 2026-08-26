import { useRef, useState, useSyncExternalStore } from "react";

type IntersectionDeps = {
  enabled: boolean;
  node: HTMLElement | null;
  threshold: number;
};

function createSubscribe(deps: IntersectionDeps, onIntersectRef: { current: () => void }) {
  return (_notify: () => void) => {
    if (!deps.enabled || deps.node === null || typeof IntersectionObserver === "undefined") {
      return () => undefined;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          onIntersectRef.current();
        }
      },
      { threshold: deps.threshold },
    );
    observer.observe(deps.node);
    return () => observer.disconnect();
  };
}

/**
 * Connects an IntersectionObserver event directly to an action while React
 * owns subscription setup and cleanup through useSyncExternalStore.
 * Subscribe identity is kept stable via render-time state adjustment so the
 * observer is not torn down every render (independent of the React Compiler).
 * `onIntersect` is read through a ref so inline callbacks do not force
 * resubscription.
 */
export function useIntersectionAction(opts: {
  enabled: boolean;
  onIntersect: () => void;
  threshold: number;
}) {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const onIntersectRef = useRef(opts.onIntersect);
  onIntersectRef.current = opts.onIntersect;

  const deps: IntersectionDeps = {
    enabled: opts.enabled,
    node,
    threshold: opts.threshold,
  };
  const [subscription, setSubscription] = useState(() => ({
    deps,
    subscribe: createSubscribe(deps, onIntersectRef),
  }));
  if (
    deps.enabled !== subscription.deps.enabled ||
    deps.node !== subscription.deps.node ||
    deps.threshold !== subscription.deps.threshold
  ) {
    setSubscription({
      deps,
      subscribe: createSubscribe(deps, onIntersectRef),
    });
  }
  useSyncExternalStore(
    subscription.subscribe,
    () => 0,
    () => 0,
  );
  return setNode;
}
