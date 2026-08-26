import { useSyncExternalStore } from "react";

/**
 * Module-level set of dismissed string ids with useSyncExternalStore so feature
 * components can hide UI after dismiss without local useState.
 */
export function createDismissedIdsStore() {
  const dismissed = new Set<string>();
  const listeners = new Set<() => void>();
  let version = 0;

  function subscribe(notify: () => void) {
    listeners.add(notify);
    return () => {
      listeners.delete(notify);
    };
  }

  function getVersion() {
    return version;
  }

  function dismiss(id: string) {
    if (dismissed.has(id)) return;
    dismissed.add(id);
    version += 1;
    for (const listener of listeners) {
      listener();
    }
  }

  function isDismissed(id: string) {
    return dismissed.has(id);
  }

  function useIsDismissed(id: string) {
    const currentVersion = useSyncExternalStore(subscribe, getVersion, () => 0);
    void currentVersion;
    return isDismissed(id);
  }

  return { dismiss, isDismissed, useIsDismissed };
}
