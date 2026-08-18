import { useMemo, useSyncExternalStore } from "react";

function createTransientFlagStore(durationMs: number) {
  let active = false;
  let expiresAt = 0;
  let timeout: ReturnType<typeof setTimeout> | null = null;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function clearTimer() {
    if (timeout !== null) {
      clearTimeout(timeout);
      timeout = null;
    }
  }

  function expire() {
    clearTimer();
    if (!active) return;
    active = false;
    expiresAt = 0;
    emit();
  }

  function scheduleExpiration() {
    clearTimer();
    if (!active || listeners.size === 0) return;
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) {
      expire();
      return;
    }
    timeout = setTimeout(expire, remainingMs);
  }

  return {
    activate: () => {
      active = true;
      expiresAt = Date.now() + durationMs;
      emit();
      scheduleExpiration();
    },
    getSnapshot: () => active && Date.now() < expiresAt,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      scheduleExpiration();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) {
          clearTimer();
        }
      };
    },
  };
}

/**
 * A user-triggered flag that derives its active state from a deadline.
 * Timing lives in an external store, so consumers need no synchronization
 * effect and inactive flags hold no running timer.
 */
export function useTransientFlag(durationMs: number) {
  const store = useMemo(() => createTransientFlagStore(durationMs), [durationMs]);
  const active = useSyncExternalStore(store.subscribe, store.getSnapshot, () => false);
  return [active, store.activate] as const;
}
