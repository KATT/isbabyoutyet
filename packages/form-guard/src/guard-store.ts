/**
 * Framework-free form leave-guard core. One mutable store per guarded
 * overlay/page owns the submit lock, dirty registry, and discard queue, and
 * answers "may we leave this unsaved form?" for every adapter (Base UI
 * dismissal, router blocking, `beforeunload`).
 *
 * Stores stack: dirty state registers with every ancestor, submit locks and
 * leave permission apply stack-wide, and discard requests route to the stack
 * root so one gesture that dismisses several dirty overlays (dialog backdrop
 * + nested popover outside-press) yields a single prompt whose Discard closes
 * the whole stack.
 *
 * All mutations happen in event handlers and effects — never during render —
 * and the only reactive output (prompt open) is exposed via
 * `subscribe`/`isPromptOpen` for `useSyncExternalStore`.
 */
import { isNativeDatePickerDismiss, overlayDismissDecision } from "./dismiss.js";
import type { OverlayDismissDecision } from "./dismiss.js";

/** Structural subset of Base UI Root ChangeEventDetails (popover / dialog / alert-dialog). */
export type OverlayDismissEventDetails = {
  reason: string;
  cancel: () => void;
};

export type OverlayOpenChangeHandler = (
  open: boolean,
  eventDetails: OverlayDismissEventDetails,
) => void;

/** Identical shape across Popover / Dialog / AlertDialog Root.Actions. */
export type OverlayActions = {
  close: () => void;
  unmount: () => void;
};

export interface FormGuardStore {
  /** Base UI Root actions handle; pass as `actionsRef` so `close()` works. */
  actionsRef: { current: OverlayActions | null };
  /** Close the overlay imperatively (allowed even mid-submit / dirty). */
  close: () => void;

  /** Subscribe to prompt-open changes (for `useSyncExternalStore`). */
  subscribe: (listener: () => void) => () => void;
  /** Whether this store's discard prompt is open. */
  isPromptOpen: () => boolean;

  /** Register a form's dirty flag; a `false → true` transition re-arms the guard. */
  setDirty: (id: string, isDirty: boolean) => void;
  /** Any registered dirty form, unless leaving was explicitly allowed. */
  isDirty: () => boolean;

  /** Counted so overlapping submits from sibling forms keep the lock held. */
  acquireSubmitLock: () => void;
  releaseSubmitLock: () => void;
  /** Permit the next overlay close / navigation even while still dirty. */
  allowLeave: () => void;
  /** Re-arm discard confirmation after a failed submit. */
  revokeAllowLeave: () => void;

  /** Wired by the context provider; the last ancestor is the stack root. */
  setAncestors: (ancestors: FormGuardStore[]) => void;
  /**
   * Queue `target` for closing and open this store's prompt. Callers route
   * requests through the stack root so merged gestures share one prompt.
   */
  requestDiscard: (target: FormGuardStore) => void;
  /** Close the prompt without leaving; clears the queued targets. */
  keepEditing: () => void;
  /** Confirm leaving: allow-leave and close every queued target. */
  discard: () => void;

  /**
   * Run the dismiss decision for a Base UI `onOpenChange` event, applying
   * `cancel()` for block/confirm and queueing the discard prompt on the stack
   * root for confirm. Returns the decision so the caller can forward allowed
   * closes to its own handler.
   */
  handleOpenChange: (
    open: boolean,
    eventDetails: OverlayDismissEventDetails,
  ) => OverlayDismissDecision;
}

export function createFormGuardStore(): FormGuardStore {
  const dirtyIds = new Set<string>();
  const listeners = new Set<() => void>();
  let pendingSubmits = 0;
  let leaveAllowed = false;
  let discardIntent: "idle" | "discard" = "idle";
  let ancestors: FormGuardStore[] = [];
  let pendingDiscards: FormGuardStore[] = [];
  let promptOpen = false;

  function setPromptOpen(next: boolean) {
    if (promptOpen === next) {
      return;
    }
    promptOpen = next;
    for (const listener of listeners) {
      listener();
    }
  }

  const store: FormGuardStore = {
    actionsRef: { current: null },
    close: () => {
      store.actionsRef.current?.close();
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isPromptOpen: () => promptOpen,
    setDirty: (id, isDirty) => {
      const wasDirty = dirtyIds.size > 0;
      if (isDirty) {
        dirtyIds.add(id);
      } else {
        dirtyIds.delete(id);
      }
      if (!wasDirty && dirtyIds.size > 0) {
        leaveAllowed = false;
        discardIntent = "idle";
      }
    },
    isDirty: () => dirtyIds.size > 0 && !leaveAllowed,
    acquireSubmitLock: () => {
      pendingSubmits += 1;
    },
    releaseSubmitLock: () => {
      pendingSubmits -= 1;
    },
    allowLeave: () => {
      leaveAllowed = true;
    },
    revokeAllowLeave: () => {
      leaveAllowed = false;
      discardIntent = "idle";
    },
    setAncestors: (next) => {
      ancestors = next;
    },
    requestDiscard: (target) => {
      pendingDiscards.push(target);
      setPromptOpen(true);
    },
    keepEditing: () => {
      if (discardIntent === "discard") {
        return;
      }
      pendingDiscards = [];
      setPromptOpen(false);
    },
    discard: () => {
      discardIntent = "discard";
      leaveAllowed = true;
      setPromptOpen(false);
      const targets = pendingDiscards;
      pendingDiscards = [];
      for (const target of targets) {
        target.allowLeave();
        target.close();
      }
    },
    handleOpenChange: (open, eventDetails) => {
      const decision = overlayDismissDecision({
        isLocked: pendingSubmits > 0,
        isDirty: store.isDirty(),
        isPickerDismiss: isNativeDatePickerDismiss(eventDetails.reason),
        open,
        reason: eventDetails.reason,
      });
      switch (decision) {
        case "allow":
          break;
        case "block":
          eventDetails.cancel();
          break;
        case "confirm": {
          eventDetails.cancel();
          // The outermost store hosts the prompt: its provider lives outside
          // nested popups, and one gesture that dismisses several dirty
          // overlays must yield a single prompt closing the whole stack.
          const host = ancestors.at(-1) ?? store;
          host.requestDiscard(store);
          break;
        }
        default: {
          const _exhaustive: never = decision;
          return _exhaustive;
        }
      }
      return decision;
    },
  };
  return store;
}
