/**
 * TanStack Router adapter: blocks in-app navigation (and `beforeunload`)
 * while the guard's stack is dirty, sharing the same discard prompt as
 * overlay dismissal. The store has stable identity, so the blocker callbacks
 * never go stale — no latest-ref bookkeeping.
 */
import { useBlocker } from "@tanstack/react-router";
import type { FormGuardHandle } from "./use-form-guard.js";

/**
 * Blocks in-app navigation while the form has unsaved edits, using the same
 * discard prompt as overlay dismiss. The provider mounts this at the stack
 * root only — dirty state already bubbles up, so nested guards would
 * double-block.
 */
export function useFormNavigationGuard(guard: FormGuardHandle) {
  const store = guard.store;
  return useBlocker({
    enableBeforeUnload: () => store.isDirty(),
    shouldBlockFn: () => store.isDirty(),
    withResolver: true,
  });
}
