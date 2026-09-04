/**
 * Pure dismiss-decision layer: given the guard's state and the overlay's
 * close reason, decide whether to allow, block, or confirm the close.
 * No React, no store — the store consumes this.
 */

export type OverlayDismissDecision = "allow" | "block" | "confirm";

/**
 * Decide what a form overlay should do with a close attempt.
 *
 * - `block`: keep the overlay open (submit lock, native date picker)
 * - `confirm`: keep the overlay open and prompt to discard unsaved edits
 * - `allow`: forward the close (idle, or imperative success-close)
 */
export function overlayDismissDecision(opts: {
  isDirty: boolean;
  isLocked: boolean;
  isPickerDismiss: boolean;
  open: boolean;
  reason: string;
}): OverlayDismissDecision {
  if (opts.open) {
    return "allow";
  }
  // Base UI's imperative close (`actionsRef.close()` / success-close paths).
  // Programmatic closes that should still ask use `REQUEST_CLOSE_REASON`.
  if (opts.reason === "imperative-action") {
    return "allow";
  }
  if (opts.isPickerDismiss || opts.isLocked) {
    return "block";
  }
  if (opts.isDirty) {
    return "confirm";
  }
  return "allow";
}

/**
 * Whether a Base UI overlay close attempt should be cancelled while a form submits.
 * Allows `imperative-action` so success closes from inside `handleSubmit` still work
 * (they fire while `isSubmitting` is still true).
 */
export function shouldBlockOverlayDismiss(opts: {
  isLocked: boolean;
  open: boolean;
  reason: string;
}) {
  return (
    overlayDismissDecision({
      isDirty: false,
      isLocked: opts.isLocked,
      isPickerDismiss: false,
      open: opts.open,
      reason: opts.reason,
    }) === "block"
  );
}

/**
 * Native `<input type="date|datetime-local|time">` pickers render outside the
 * overlay; Base UI reports that as outside-press / focus-out.
 */
export function isNativeDatePickerDismiss(reason: string) {
  if (reason !== "outside-press" && reason !== "focus-out") {
    return false;
  }
  const activeElement = document.activeElement;
  return (
    isHtmlInput(activeElement) &&
    (activeElement.type === "date" ||
      activeElement.type === "datetime-local" ||
      activeElement.type === "time")
  );
}

function isHtmlInput(value: Element | null): value is HTMLInputElement {
  return value !== null && Object.prototype.isPrototypeOf.call(HTMLInputElement.prototype, value);
}
