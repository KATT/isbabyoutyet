import { useEffect } from "react";

/**
 * The single audited seam for actions that must happen after elapsed time.
 * Callers supply stable, domain-level actions; this hook owns timer cleanup.
 */
export function useDelayedAction(opts: { action: () => void; delayMs: number; enabled: boolean }) {
  useEffect(() => {
    if (!opts.enabled) return;
    const timeout = window.setTimeout(opts.action, opts.delayMs);
    return () => window.clearTimeout(timeout);
  }, [opts.action, opts.delayMs, opts.enabled]);
}
