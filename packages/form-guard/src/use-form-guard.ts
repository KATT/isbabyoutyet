/**
 * React layer over the framework-free guard store: creates one store per
 * guard, owns (or mirrors) the overlay's open state, bridges the prompt-open
 * state via `useSyncExternalStore`, stacks stores through context (wired in
 * effects, never during render), and registers reactive form state with
 * every store in the stack.
 *
 * The provider figures out stacking by itself: the outermost provider is the
 * stack root, which mounts the navigation blocker and renders the app's
 * discard prompt; nested providers only relay to it.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { createFormGuardStore, REQUEST_CLOSE_REASON } from "./guard-store.js";
import type { FormGuardStore, FormStateFlags, OverlayOpenChangeHandler } from "./guard-store.js";
import { useFormNavigationGuard } from "./router.js";

/**
 * How the guard relates to an overlay's open state:
 *
 * - **controlled** — the caller owns `open` (route-backed overlays, URL
 *   search state) and receives every allowed change via `onOpenChange`.
 * - **uncontrolled** — the guard owns `open` (popover / dialog editors that
 *   open from a trigger); pass `defaultOpen`.
 * - **`null`** — no overlay at all (full-page forms that only need the
 *   navigation guard).
 */
export type FormGuardOverlay =
  | { onOpenChange: (open: boolean) => void; open: boolean }
  | { defaultOpen: boolean }
  | null;

export type FormGuardHandle = {
  /**
   * Close the overlay unconditionally (success paths, "Cancel" buttons).
   * Safe mid-submit and while dirty — the guard does not ask. No-op on full
   * pages.
   */
  close: () => void;
  /** @internal consumed by the app's discard dialog. */
  discardPrompt: {
    onDiscard: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  };
  /** Whether the overlay is currently open. */
  open: boolean;
  /**
   * Close the overlay the way a user dismissal would: blocked while a form
   * submits, confirmed with the discard prompt while one is dirty, otherwise
   * closes. For close controls rendered *outside* the overlay (nav toggles).
   */
  requestClose: () => void;
  /**
   * Overlay adapter — spread onto the Base UI Root (`Popover` / `Dialog` /
   * `AlertDialog` / `Sheet`). Controls `open` and runs every open-change
   * through the guard.
   */
  rootProps: {
    onOpenChange: OverlayOpenChangeHandler;
    open: boolean;
  };
  /** @internal consumed by the context provider and the router adapter. */
  store: FormGuardStore;
};

type FormGuardContextValue = {
  ancestors: Array<FormGuardStore>;
  store: FormGuardStore;
};

const FormGuardContext = createContext<FormGuardContextValue | null>(null);

const NO_ANCESTORS: Array<FormGuardStore> = [];

/**
 * Every store from the nearest provider up to the stack root. Submit locks
 * and leave permission apply to the whole stack: a successful save inside a
 * nested editor must also unblock the parent overlay's dismiss and
 * navigation guard. Empty outside any provider.
 *
 * Identity is not load-bearing: the store treats re-registration of the same
 * flags as a no-op, so effects keyed on this array may re-run freely.
 */
function useFormGuardStack(): Array<FormGuardStore> {
  const ctx = useContext(FormGuardContext);
  return ctx ? [ctx.store, ...ctx.ancestors] : NO_ANCESTORS;
}

/**
 * Props the guard hands to the app's discard prompt: pre-merged across the
 * two leave paths (overlay dismiss and blocked navigation), so the prompt is
 * purely presentational — Keep editing calls `onOpenChange(false)`, Discard
 * calls `onDiscard`.
 */
export type DiscardPromptProps = {
  onDiscard: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * Wrap form content so child forms register submits and dirty state.
 *
 * Providers stack through context: the outermost one is the stack root and
 * owns everything root-scoped — it mounts the navigation blocker (dirty
 * state bubbles up, so nested blockers would double-block) and renders the
 * single `DiscardPrompt` for the whole stack (nested guards route their
 * discard requests to it).
 */
export function FormGuardProvider(props: {
  children: ReactNode;
  guard: FormGuardHandle;
  /** Localized confirm UI (e.g. an AlertDialog); rendered once at the stack root. */
  renderDiscardPrompt: (promptProps: DiscardPromptProps) => ReactNode;
}) {
  const store = props.guard.store;
  // The stack seen from the provider (i.e. the parent's) is this guard's
  // ancestor chain; wired in an effect so render stays pure.
  const ancestors = useFormGuardStack();
  const isStackRoot = ancestors.length === 0;
  useEffect(() => {
    store.setAncestors(ancestors);
  }, [store, ancestors]);
  return createElement(
    FormGuardContext.Provider,
    { value: { ancestors, store } },
    props.children,
    isStackRoot
      ? createElement(StackRootDiscardHost, {
          guard: props.guard,
          renderDiscardPrompt: props.renderDiscardPrompt,
        })
      : null,
  );
}

/**
 * Mounted by the stack root only: subscribes the navigation blocker and
 * merges its blocked state with the overlay discard prompt, so both leave
 * paths share one prompt UI and one answer.
 */
function StackRootDiscardHost(props: {
  guard: FormGuardHandle;
  renderDiscardPrompt: (promptProps: DiscardPromptProps) => ReactNode;
}) {
  const navigation = useFormNavigationGuard(props.guard);
  const prompt = props.guard.discardPrompt;
  const blocked = navigation.status === "blocked";
  return props.renderDiscardPrompt({
    onDiscard: () => {
      prompt.onDiscard();
      if (navigation.status === "blocked") {
        navigation.proceed();
      }
    },
    onOpenChange: (open) => {
      if (open) {
        return;
      }
      prompt.onOpenChange(false);
      if (navigation.status === "blocked") {
        navigation.reset();
      }
    },
    open: prompt.open || blocked,
  });
}

function promptClosedOnServer() {
  return false;
}

function noop() {}

/**
 * Form that may be left via overlay dismiss or in-app navigation: owns the
 * overlay's open state (or mirrors the caller's), a submit lock, and
 * unsaved-edit confirmation for both adapters.
 *
 * While any child form submits, user dismissal is cancelled; the imperative
 * success-close is not. While any child form is dirty, user dismissal opens a
 * discard confirmation instead of closing.
 */
export function useFormGuard(overlay: FormGuardOverlay): FormGuardHandle {
  const [store] = useState(createFormGuardStore);
  const [uncontrolledOpen, setUncontrolledOpen] = useState(
    overlay !== null && "defaultOpen" in overlay ? overlay.defaultOpen : false,
  );
  const controlled = overlay !== null && "open" in overlay;
  const open = controlled ? overlay.open : overlay === null ? false : uncontrolledOpen;
  const setOpen = controlled ? overlay.onOpenChange : overlay === null ? noop : setUncontrolledOpen;
  // The store closes queued targets on Discard; re-wire the closer whenever a
  // controlled caller hands over a new `onOpenChange`.
  useEffect(() => {
    store.setCloser(() => {
      setOpen(false);
    });
    return () => {
      store.setCloser(null);
    };
  }, [store, setOpen]);
  const promptOpen = useSyncExternalStore(
    store.subscribe,
    store.isPromptOpen,
    promptClosedOnServer,
  );
  const onOpenChange: OverlayOpenChangeHandler = (nextOpen, eventDetails) => {
    if (store.handleOpenChange(nextOpen, eventDetails) === "allow") {
      setOpen(nextOpen);
    }
  };

  return {
    close: () => {
      setOpen(false);
    },
    discardPrompt: {
      onDiscard: store.discard,
      onOpenChange: (promptIsOpen) => {
        if (!promptIsOpen) {
          store.keepEditing();
        }
      },
      open: promptOpen,
    },
    open,
    requestClose: () => {
      onOpenChange(false, { cancel: noop, reason: REQUEST_CLOSE_REASON });
    },
    rootProps: {
      onOpenChange,
      open,
    },
    store,
  };
}

/**
 * Registers this form's reactive state with the nearest provider's store and
 * every ancestor store. Stacked overlays (settings + nested editor) share one
 * leave question: a dirty child must block the parent too.
 *
 * Takes plain booleans (a structural subset of React Hook Form's
 * `formState`), so any form library can feed it and the guard needs no
 * imperative submit lock: `isSubmitting` blocks user dismissal while it
 * holds, and `isDirty && !isSubmitting && !isSubmitSuccessful` is the
 * "unsaved edits" signal that blocks leaving.
 *
 * Flag updates patch the registration in place; only unmount (or a change
 * of stack) clears the slot, so a re-render never looks like a fresh form.
 */
export function useRegisterFormState(flags: FormStateFlags) {
  const stores = useFormGuardStack();
  const id = useId();
  const isDirty = flags.isDirty;
  const isSubmitting = flags.isSubmitting;
  const isSubmitSuccessful = flags.isSubmitSuccessful;
  useEffect(() => {
    for (const store of stores) {
      store.setFormState(id, { isDirty, isSubmitSuccessful, isSubmitting });
    }
  }, [id, stores, isDirty, isSubmitting, isSubmitSuccessful]);
  useEffect(() => {
    return () => {
      for (const store of stores) {
        store.setFormState(id, null);
      }
    };
  }, [id, stores]);
}
