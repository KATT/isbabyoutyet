import { useEffect, useRef, useState } from "react";

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

/**
 * Reports a value transition for a bounded amount of time. Initial values do
 * not count as transitions, which prevents stale query history from replaying.
 */
export function useTimedTransition<$Value>(opts: {
  durationMs: number;
  from: $Value;
  to: $Value;
  value: $Value;
}) {
  const previous = useRef(opts.value);
  const [active, setActive] = useState(false);

  useEffect(() => {
    const transitioned = Object.is(previous.current, opts.from) && Object.is(opts.value, opts.to);
    previous.current = opts.value;
    if (!transitioned) {
      setActive(false);
      return;
    }
    setActive(true);
    const timeout = window.setTimeout(() => setActive(false), opts.durationMs);
    return () => window.clearTimeout(timeout);
  }, [opts.durationMs, opts.from, opts.to, opts.value]);

  return active;
}
