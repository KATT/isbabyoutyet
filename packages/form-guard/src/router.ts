/**
 * TanStack Router adapter: blocks in-app navigation (and `beforeunload`)
 * while the guard's stack is dirty, sharing the same discard prompt as
 * overlay dismissal. The store has stable identity, so the blocker callbacks
 * never go stale — no latest-ref bookkeeping.
 */
import { useBlocker, useRouter } from "@tanstack/react-router";
import type { FormGuardHandle } from "./use-form-guard.js";

/** Router when rendered under a `RouterProvider`, otherwise `null` (e.g. bare component tests). */
export function useOptionalRouter() {
  return useRouter({ warn: false });
}

/**
 * Blocks in-app navigation while the form has unsaved edits, using the same
 * discard prompt as overlay dismiss. Mount only at the stack root — dirty
 * state already bubbles up, so nested guards would double-block.
 */
export function useFormNavigationGuard(guard: FormGuardHandle) {
  const store = guard.store;
  return useBlocker({
    shouldBlockFn: () => store.isDirty(),
    enableBeforeUnload: () => store.isDirty(),
    withResolver: true,
  });
}
