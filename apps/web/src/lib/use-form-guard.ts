/**
 * Form leave-guard: submit lock, unsaved-edit confirmation, and navigation
 * blocking. Overlay dismiss and in-app navigation are two adapters for the
 * same question — "may we leave this unsaved form?"
 *
 * Lives in `apps/web/src/lib` so it can own overlay state, RHF dirty
 * registration cleanup, and TanStack Router `history.block` / `beforeunload`.
 * Full-page forms omit `rootProps`; overlay hosts spread them onto the Base UI Root.
 */
import { useRouter, useBlocker } from "@tanstack/react-router";
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";

/** Counted so overlapping submits from sibling forms keep the overlay lock held. */
type FormSubmitLock = {
  acquire: () => void;
  release: () => void;
  /** Permit the next overlay close / navigation even while the form is still dirty. */
  allowLeave: () => void;
  /** Re-arm discard confirmation after a failed submit. */
  revokeAllowLeave: () => void;
};

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
      isLocked: opts.isLocked,
      isDirty: false,
      isPickerDismiss: false,
      open: opts.open,
      reason: opts.reason,
    }) === "block"
  );
}

type OverlayDismissDecision = "allow" | "block" | "confirm";

/**
 * Decide what a form overlay should do with a close attempt.
 *
 * - `block`: keep the overlay open (submit lock, native date picker)
 * - `confirm`: keep the overlay open and prompt to discard unsaved edits
 * - `allow`: forward the close (idle, or imperative success-close)
 */
function overlayDismissDecision(opts: {
  isLocked: boolean;
  isDirty: boolean;
  isPickerDismiss: boolean;
  open: boolean;
  reason: string;
}): OverlayDismissDecision {
  if (opts.open) {
    return "allow";
  }
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
 * Native `<input type="date|datetime-local|time">` pickers render outside the
 * overlay; Base UI reports that as outside-press / focus-out.
 */
function isNativeDatePickerDismiss(reason: string) {
  if (reason !== "outside-press" && reason !== "focus-out") {
    return false;
  }
  const activeElement = document.activeElement;
  return (
    activeElement instanceof HTMLInputElement &&
    (activeElement.type === "date" ||
      activeElement.type === "datetime-local" ||
      activeElement.type === "time")
  );
}

/** Structural subset of Base UI Root ChangeEventDetails (popover / dialog / alert-dialog). */
type OverlayDismissEventDetails = {
  reason: string;
  cancel: () => void;
};

type OverlayOpenChangeHandler = (open: boolean, eventDetails: OverlayDismissEventDetails) => void;

/** Identical shape across Popover / Dialog / AlertDialog Root.Actions. */
type OverlayActions = {
  close: () => void;
  unmount: () => void;
};

type FormDirtyLock = {
  set: (id: string, isDirty: boolean) => void;
  isDirty: () => boolean;
};

/** What the discard prompt closes when the user confirms leaving. */
type DiscardTarget = {
  allowLeave: () => void;
  close: () => void;
};

type FormDiscardPrompt = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
  /**
   * Queue `target` for closing and open this guard's prompt. Stacked overlays
   * (settings dialog + nested editor popover) route requests to the stack
   * root, so one gesture that dismisses several dirty overlays yields a
   * single prompt whose Discard closes them all.
   */
  request: (target: DiscardTarget) => void;
};

export type FormGuardHandle = {
  /**
   * Close the overlay when {@link FormGuardHandle.rootProps} is spread onto a
   * Base UI Root. No-op on full pages that only use the navigation guard.
   * Safe mid-submit: reports `imperative-action`, which the guard allows.
   */
  close: () => void;
  /**
   * Overlay adapter — spread onto the Base UI Root (`Popover` / `Dialog` /
   * `AlertDialog` / `Sheet`). Omit on full-page forms.
   */
  rootProps: {
    actionsRef: RefObject<OverlayActions | null>;
    onOpenChange: OverlayOpenChangeHandler;
  };
  /** @internal consumed by {@link FormGuardProvider}. */
  lock: FormSubmitLock;
  /** @internal consumed by {@link useRegisterFormDirty}. */
  dirty: FormDirtyLock;
  /** @internal consumed by {@link FormGuardProvider}. */
  discardPrompt: FormDiscardPrompt;
  /**
   * @internal wired by {@link FormGuardContextProvider} during render so the
   * guard knows which ancestor (the stack root) hosts its discard prompt.
   */
  setAncestors: (ancestors: FormGuardHandle[]) => void;
};

type FormGuardContextValue = {
  guard: FormGuardHandle;
  ancestors: FormGuardHandle[];
};

const FormGuardContext = createContext<FormGuardContextValue | null>(null);

export function useFormGuardContext() {
  return useContext(FormGuardContext)?.guard ?? null;
}

/**
 * Every guard from the nearest provider up to the stack root. Submit locks and
 * leave permission apply to the whole stack: a successful save inside a nested
 * editor must also unblock the parent overlay's dismiss and navigation guard.
 */
export function useFormGuardStack() {
  return guardStack(useContext(FormGuardContext));
}

/** Wrap form content so child forms register submits and dirty state. */
export function FormGuardContextProvider(props: { guard: FormGuardHandle; children: ReactNode }) {
  const parent = useContext(FormGuardContext);
  const ancestors = parent ? [parent.guard, ...parent.ancestors] : [];
  // Written during render (latest-callback idiom) so a same-frame dismiss
  // already routes its discard prompt to the stack root.
  props.guard.setAncestors(ancestors);
  return createElement(
    FormGuardContext.Provider,
    {
      value: {
        guard: props.guard,
        ancestors,
      },
    },
    props.children,
  );
}

/**
 * Form that may be left via overlay dismiss or in-app navigation: owns the
 * actions ref, a submit lock, and unsaved-edit confirmation for both adapters.
 *
 * While any child form submits, user dismissal is cancelled; the imperative
 * success-close is not. While any child form is dirty, user dismissal opens a
 * discard confirmation instead of closing.
 */
export function useFormGuard(opts: {
  /** Extra open-change logic (e.g. forwarded overlay-nav close); pass `undefined` otherwise. */
  onOpenChange: OverlayOpenChangeHandler | undefined;
}): FormGuardHandle {
  const actionsRef = useRef<OverlayActions | null>(null);
  const pendingSubmitsRef = useRef(0);
  const dirtyIdsRef = useRef(new Set<string>());
  const allowLeaveRef = useRef(false);
  const discardIntentRef = useRef<"idle" | "discard">("idle");
  const ancestorsRef = useRef<FormGuardHandle[]>([]);
  const pendingDiscardsRef = useRef<DiscardTarget[]>([]);
  const [discardOpen, setDiscardOpen] = useState(false);

  function isDirty() {
    return dirtyIdsRef.current.size > 0 && !allowLeaveRef.current;
  }

  /** What discarding this guard means for whichever prompt hosts the question. */
  const selfTarget: DiscardTarget = {
    allowLeave: () => {
      allowLeaveRef.current = true;
    },
    close: () => {
      actionsRef.current?.close();
    },
  };

  function requestDiscard(target: DiscardTarget) {
    pendingDiscardsRef.current.push(target);
    setDiscardOpen(true);
  }

  function keepEditing() {
    if (discardIntentRef.current === "discard") {
      return;
    }
    pendingDiscardsRef.current = [];
    setDiscardOpen(false);
  }

  function discard() {
    discardIntentRef.current = "discard";
    allowLeaveRef.current = true;
    setDiscardOpen(false);
    const targets = pendingDiscardsRef.current;
    pendingDiscardsRef.current = [];
    for (const target of targets) {
      target.allowLeave();
      target.close();
    }
  }

  return {
    close: () => {
      actionsRef.current?.close();
    },
    lock: {
      acquire: () => {
        pendingSubmitsRef.current += 1;
      },
      release: () => {
        pendingSubmitsRef.current -= 1;
      },
      allowLeave: () => {
        allowLeaveRef.current = true;
      },
      revokeAllowLeave: () => {
        allowLeaveRef.current = false;
        discardIntentRef.current = "idle";
      },
    },
    dirty: {
      set: (id, nextDirty) => {
        const wasDirty = dirtyIdsRef.current.size > 0;
        if (nextDirty) {
          dirtyIdsRef.current.add(id);
        } else {
          dirtyIdsRef.current.delete(id);
        }
        const nowDirty = dirtyIdsRef.current.size > 0;
        if (!wasDirty && nowDirty) {
          allowLeaveRef.current = false;
          discardIntentRef.current = "idle";
        }
      },
      isDirty,
    },
    discardPrompt: {
      open: discardOpen,
      onOpenChange: (open) => {
        if (!open) {
          keepEditing();
        }
      },
      onDiscard: () => {
        discard();
      },
      request: requestDiscard,
    },
    setAncestors: (ancestors) => {
      ancestorsRef.current = ancestors;
    },
    rootProps: {
      actionsRef,
      onOpenChange: (open, eventDetails) => {
        const decision = overlayDismissDecision({
          isLocked: pendingSubmitsRef.current > 0,
          isDirty: isDirty(),
          isPickerDismiss: isNativeDatePickerDismiss(eventDetails.reason),
          open,
          reason: eventDetails.reason,
        });
        switch (decision) {
          case "allow":
            opts.onOpenChange?.(open, eventDetails);
            return;
          case "block":
            eventDetails.cancel();
            return;
          case "confirm": {
            eventDetails.cancel();
            // The outermost guard hosts the prompt: its provider lives outside
            // nested popups, and one gesture that dismisses several dirty
            // overlays (dialog backdrop + nested popover outside-press) must
            // yield a single prompt that closes the whole stack on Discard.
            const host = ancestorsRef.current.at(-1);
            if (host) {
              host.discardPrompt.request(selfTarget);
            } else {
              requestDiscard(selfTarget);
            }
            return;
          }
          default: {
            const _exhaustive: never = decision;
            return _exhaustive;
          }
        }
      },
    },
  };
}

function guardStack(ctx: FormGuardContextValue | null) {
  return ctx ? [ctx.guard, ...ctx.ancestors] : [];
}

/**
 * Registers this form's dirty flag with the nearest {@link FormGuardProvider}
 * and every ancestor guard. Stacked overlays (settings + nested editor) share
 * one leave question: a dirty child must block the parent too.
 *
 * Writes during render so a same-frame dismiss sees the latest value; effect
 * cleanup clears the slot when the form unmounts.
 *
 * Syncs React Hook Form `isDirty` into the guard's dirty lock (external
 * subscription owned by the guard, not the feature tree).
 */
export function useRegisterFormDirty(isDirty: boolean) {
  const ctx = useContext(FormGuardContext);
  const id = useId();
  const registeredRef = useRef<FormGuardHandle[]>([]);
  const targets = guardStack(ctx);
  const previous = registeredRef.current;
  const nextTargets = new Set(targets);
  for (const guard of previous) {
    if (!nextTargets.has(guard)) {
      guard.dirty.set(id, false);
    }
  }
  registeredRef.current = targets;
  for (const guard of targets) {
    guard.dirty.set(id, isDirty);
  }
  useEffect(() => {
    return () => {
      for (const guard of registeredRef.current) {
        guard.dirty.set(id, false);
      }
    };
  }, [id, registeredRef]);
}

export function useOptionalRouter() {
  return useRouter({ warn: false });
}

/**
 * Blocks in-app navigation while the form has unsaved edits, using the
 * same discard prompt as overlay dismiss.
 *
 * Subscribes to TanStack Router history.block (and beforeunload). Mounted
 * from {@link FormGuardProvider} only when a router is present.
 */
export function useFormNavigationGuard(guard: FormGuardHandle) {
  const guardRef = useRef(guard);
  guardRef.current = guard;
  return useBlocker({
    shouldBlockFn: () => guardRef.current.dirty.isDirty(),
    enableBeforeUnload: () => guardRef.current.dirty.isDirty(),
    withResolver: true,
  });
}
