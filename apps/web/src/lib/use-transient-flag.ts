import { useEffect, useState } from "react";

/**
 * A user-triggered flag that stays true for `durationMs` after each activate().
 * Retriggering resets the timer. Lives in `apps/web/src/lib` so the timeout
 * effect is an audited seam rather than feature-component synchronization.
 */
export function useTransientFlag(durationMs: number) {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timeout = window.setTimeout(() => setActive(false), durationMs);
    return () => window.clearTimeout(timeout);
  }, [active, durationMs]);

  function activate() {
    setActive(true);
  }

  return [active, activate] as const;
}
