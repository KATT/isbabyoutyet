/**
 * Framework-free form leave-guard core. One mutable store per guarded
 * overlay/page answers "may we leave this unsaved form?" for every adapter
 * (Base UI dismissal, router blocking, `beforeunload`).
 *
 * Forms register reactive flags (`isDirty` / `isSubmitting` /
 * `isSubmitSuccessful`) instead of taking imperative locks, so there is no
 * acquire/release pairing to leak across renders or overlapping submits:
 *
 * - user dismissal is blocked while any form submits
 * - edits block leaving only while unsaved: not during a submit (success
 *   paths navigate mid-submit) and not after a successful one; a failed
 *   submit re-arms the guard by itself
 *
 * Stores stack: forms register with every ancestor, and discard requests
 * route to the stack root so one gesture that dismisses several dirty
 * overlays (dialog backdrop + nested popover outside-press) yields a single
 * prompt whose Discard closes the whole stack.
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

/** Structural subset of React Hook Form's `formState` (any form library fits). */
export type FormStateFlags = {
  isDirty: boolean;
  isSubmitting: boolean;
  isSubmitSuccessful: boolean;
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

  /**
   * Register a form's reactive state, or clear it with `null` on unmount.
   * When unsaved edits (re)appear — including after a failed submit — the
   * guard re-arms and a previous Discard's leave permission is revoked.
   */
  setFormState: (id: string, flags: FormStateFlags | null) => void;
  /**
   * Any form with unsaved edits worth guarding, unless leaving was permitted
   * by a Discard. Edits mid-submit or after a successful submit don't count:
   * success paths close overlays and navigate while the form is still dirty.
   */
  isDirty: () => boolean;

  /** Wired by the context provider; the last ancestor is the stack root. */
  setAncestors: (ancestors: FormGuardStore[]) => void;
  /** @internal Permit leaving despite unsaved edits (Discard on this target). */
  allowLeave: () => void;
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
  const forms = new Map<string, FormStateFlags>();
  const listeners = new Set<() => void>();
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

  function hasBlockingEdits() {
    for (const flags of forms.values()) {
      if (flags.isDirty && !flags.isSubmitting && !flags.isSubmitSuccessful) {
        return true;
      }
    }
    return false;
  }

  function isSubmitting() {
    for (const flags of forms.values()) {
      if (flags.isSubmitting) {
        return true;
      }
    }
    return false;
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
    setFormState: (id, flags) => {
      const wasBlocking = hasBlockingEdits();
      if (flags) {
        forms.set(id, flags);
      } else {
        forms.delete(id);
      }
      // Unsaved edits (re)appearing — a fresh edit or a failed submit —
      // re-arm the guard and revoke any earlier Discard's leave permission.
      if (!wasBlocking && hasBlockingEdits()) {
        leaveAllowed = false;
        discardIntent = "idle";
      }
    },
    isDirty: () => hasBlockingEdits() && !leaveAllowed,
    setAncestors: (next) => {
      ancestors = next;
    },
    allowLeave: () => {
      leaveAllowed = true;
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
        isLocked: isSubmitting(),
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
