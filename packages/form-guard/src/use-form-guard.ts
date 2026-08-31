/**
 * React layer over the framework-free guard store: creates one store per
 * guard, bridges its prompt-open state via `useSyncExternalStore`, stacks
 * stores through context (wired in effects, never during render), and
 * registers form dirty flags with every store in the stack.
 *
 * The dirty input is just a boolean — wire it from React Hook Form's
 * `formState.isDirty`, or any other form library's equivalent.
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
import { createFormGuardStore } from "./guard-store.js";
import type { FormGuardStore, OverlayActions, OverlayOpenChangeHandler } from "./guard-store.js";

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
    actionsRef: { current: OverlayActions | null };
    onOpenChange: OverlayOpenChangeHandler;
  };
  /** @internal consumed by the context provider and the router adapter. */
  store: FormGuardStore;
  /** @internal consumed by the app's discard dialog. */
  discardPrompt: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onDiscard: () => void;
  };
};

type FormGuardContextValue = {
  store: FormGuardStore;
  ancestors: FormGuardStore[];
};

const FormGuardContext = createContext<FormGuardContextValue | null>(null);

/**
 * Every store from the nearest provider up to the stack root. Submit locks
 * and leave permission apply to the whole stack: a successful save inside a
 * nested editor must also unblock the parent overlay's dismiss and
 * navigation guard. Empty outside any provider.
 */
export function useFormGuardStack(): FormGuardStore[] {
  const ctx = useContext(FormGuardContext);
  return ctx ? [ctx.store, ...ctx.ancestors] : [];
}

/** Wrap form content so child forms register submits and dirty state. */
export function FormGuardContextProvider(props: { guard: FormGuardHandle; children: ReactNode }) {
  const store = props.guard.store;
  // The stack seen from the provider (i.e. the parent's) is this guard's
  // ancestor chain; wired in an effect so render stays pure.
  const ancestors = useFormGuardStack();
  useEffect(() => {
    store.setAncestors(ancestors);
  }, [store, ancestors]);
  return createElement(FormGuardContext.Provider, { value: { store, ancestors } }, props.children);
}

function promptClosedOnServer() {
  return false;
}

/**
 * Form that may be left via overlay dismiss or in-app navigation: owns the
 * actions handle, a submit lock, and unsaved-edit confirmation for both
 * adapters.
 *
 * While any child form submits, user dismissal is cancelled; the imperative
 * success-close is not. While any child form is dirty, user dismissal opens a
 * discard confirmation instead of closing.
 */
export function useFormGuard(opts: {
  /** Extra open-change logic (e.g. forwarded overlay-nav close); pass `undefined` otherwise. */
  onOpenChange: OverlayOpenChangeHandler | undefined;
}): FormGuardHandle {
  const [store] = useState(createFormGuardStore);
  const promptOpen = useSyncExternalStore(
    store.subscribe,
    store.isPromptOpen,
    promptClosedOnServer,
  );

  return {
    close: store.close,
    store,
    rootProps: {
      actionsRef: store.actionsRef,
      onOpenChange: (open, eventDetails) => {
        if (store.handleOpenChange(open, eventDetails) === "allow") {
          opts.onOpenChange?.(open, eventDetails);
        }
      },
    },
    discardPrompt: {
      open: promptOpen,
      onOpenChange: (open) => {
        if (!open) {
          store.keepEditing();
        }
      },
      onDiscard: store.discard,
    },
  };
}

/**
 * Registers this form's dirty flag with the nearest provider's store and
 * every ancestor store. Stacked overlays (settings + nested editor) share one
 * leave question: a dirty child must block the parent too.
 *
 * Takes a plain boolean so any form library can feed it (e.g. React Hook
 * Form's `formState.isDirty`). Effect cleanup clears the slot on unmount.
 */
export function useRegisterFormDirty(isDirty: boolean) {
  const stores = useFormGuardStack();
  const id = useId();
  useEffect(() => {
    for (const store of stores) {
      store.setDirty(id, isDirty);
    }
    return () => {
      for (const store of stores) {
        store.setDirty(id, false);
      }
    };
  }, [id, isDirty, stores]);
}
