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
 * Discard is tracked *per form*: confirming the prompt marks every form that
 * currently blocks as discarded, and a discarded form stays discarded while
 * it keeps reporting the same unsaved edits — re-registering after a
 * re-render, or unmounting while the overlay animates out, must not re-arm
 * the guard. Only a fresh edit session (the form reporting clean, then dirty
 * again) re-arms it.
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
  cancel: () => void;
  reason: string;
};

export type OverlayOpenChangeHandler = (
  open: boolean,
  eventDetails: OverlayDismissEventDetails,
) => void;

/**
 * Close reason for a programmatic close that should still be guarded like a
 * user dismissal (nav toggles, "close overlay" buttons rendered outside it).
 * Unlike Base UI's `imperative-action`, dirty forms confirm and submits block.
 */
export const REQUEST_CLOSE_REASON = "request-close";

/** Structural subset of React Hook Form's `formState` (any form library fits). */
export type FormStateFlags = {
  isDirty: boolean;
  isSubmitSuccessful: boolean;
  isSubmitting: boolean;
};

export interface FormGuardStore {
  /** Close the overlay imperatively (allowed even mid-submit / dirty). */
  close: () => void;
  /** Confirm leaving: discard the current edits and close every queued target. */
  discard: () => void;
  /**
   * @internal Mark every form that currently blocks leaving as discarded on
   * this store. Called on each queued target by the stack root's `discard`.
   */
  discardCurrentEdits: () => void;

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
  /**
   * Any form with unsaved edits worth guarding, unless those edits were
   * discarded. Edits mid-submit or after a successful submit don't count:
   * success paths close overlays and navigate while the form is still dirty.
   */
  isDirty: () => boolean;

  /** Whether this store's discard prompt is open. */
  isPromptOpen: () => boolean;
  /** Close the prompt without leaving; clears the queued targets. */
  keepEditing: () => void;
  /**
   * Queue `target` for closing and open this store's prompt. Callers route
   * requests through the stack root so merged gestures share one prompt.
   */
  requestDiscard: (target: FormGuardStore) => void;
  /** Wired by the context provider; the last ancestor is the stack root. */
  setAncestors: (ancestors: Array<FormGuardStore>) => void;
  /**
   * Wired by the React hook: how this store closes its overlay. The hook
   * re-wires it whenever the overlay's open-state setter changes.
   */
  setCloser: (close: (() => void) | null) => void;
  /**
   * Register a form's reactive state, or clear it with `null` on unmount.
   * Registering identical flags is a no-op. A form re-arms the guard (and
   * forgets that it was discarded) only when it reports clean, then dirty.
   */
  setFormState: (id: string, flags: FormStateFlags | null) => void;

  /** Subscribe to prompt-open changes (for `useSyncExternalStore`). */
  subscribe: (listener: () => void) => () => void;
}

function isBlocking(flags: FormStateFlags) {
  return flags.isDirty && !flags.isSubmitting && !flags.isSubmitSuccessful;
}

function sameFlags(left: FormStateFlags, right: FormStateFlags) {
  return (
    left.isDirty === right.isDirty &&
    left.isSubmitting === right.isSubmitting &&
    left.isSubmitSuccessful === right.isSubmitSuccessful
  );
}

export function createFormGuardStore(): FormGuardStore {
  const forms = new Map<string, FormStateFlags>();
  // Form ids whose current unsaved edits were discarded. Kept across
  // unregister so a dirty form re-registering (re-render, or unmounting while
  // its overlay animates out) does not re-arm the guard; cleared once the
  // form reports clean again.
  const discarded = new Set<string>();
  const listeners = new Set<() => void>();
  let closer: (() => void) | null = null;
  let ancestors: Array<FormGuardStore> = [];
  let pendingDiscards: Array<FormGuardStore> = [];
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
    for (const [id, flags] of forms) {
      if (isBlocking(flags) && !discarded.has(id)) {
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
    close: () => {
      closer?.();
    },
    discard: () => {
      setPromptOpen(false);
      const targets = pendingDiscards;
      pendingDiscards = [];
      store.discardCurrentEdits();
      for (const target of targets) {
        target.discardCurrentEdits();
        target.close();
      }
    },
    discardCurrentEdits: () => {
      for (const [id, flags] of forms) {
        if (isBlocking(flags)) {
          discarded.add(id);
        }
      }
    },
    handleOpenChange: (open, eventDetails) => {
      const decision = overlayDismissDecision({
        isDirty: store.isDirty(),
        isLocked: isSubmitting(),
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
    isDirty: hasBlockingEdits,
    isPromptOpen: () => promptOpen,
    keepEditing: () => {
      pendingDiscards = [];
      setPromptOpen(false);
    },
    requestDiscard: (target) => {
      pendingDiscards.push(target);
      setPromptOpen(true);
    },
    setAncestors: (next) => {
      ancestors = next;
    },
    setCloser: (close) => {
      closer = close;
    },
    setFormState: (id, flags) => {
      if (flags === null) {
        forms.delete(id);
        return;
      }
      const previous = forms.get(id);
      if (previous && sameFlags(previous, flags)) {
        return;
      }
      forms.set(id, flags);
      // A clean report ends the discarded edit session: the next unsaved
      // edits are new and guard again.
      if (!flags.isDirty) {
        discarded.delete(id);
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return store;
}
