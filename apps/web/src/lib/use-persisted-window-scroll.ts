import { useLayoutEffect, useRef } from "react";

/**
 * Saves and restores window scroll when switching between keyed views
 * (for example URL-persisted tabs). Pair with `keepMounted` tab panels so
 * content stays mounted while hidden.
 */
export function usePersistedWindowScroll(activeKey: string) {
  const scrollByKey = useRef<Record<string, number>>({});
  const previousKey = useRef(activeKey);

  useLayoutEffect(() => {
    const previous = previousKey.current;
    if (previous === activeKey) {
      return;
    }

    scrollByKey.current[previous] = window.scrollY;
    previousKey.current = activeKey;
    window.scrollTo({ top: scrollByKey.current[activeKey] ?? 0 });
  }, [activeKey]);
}
