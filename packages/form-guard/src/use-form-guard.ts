/**
 * React layer over the framework-free guard store: creates one store per
 * guard, bridges its prompt-open state via `useSyncExternalStore`, stacks
 * stores through context (wired in effects, never during render), and
 * registers reactive form state with every store in the stack.
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
import { createFormGuardStore } from "./guard-store.js";
import type {
  FormGuardStore,
  FormStateFlags,
  OverlayActions,
  OverlayOpenChangeHandler,
} from "./guard-store.js";
import { useFormNavigationGuard } from "./router.js";

export type FormGuardHandle = {
  /**
   * Close the overlay when {@link FormGuardHandle.rootProps} is spread onto a
   * Base UI Root. No-op on full pages that only use the navigation guard.
   * Safe mid-submit: reports `imperative-action`, which the guard allows.
   */
  close: () => void;
  /** @internal consumed by the app's discard dialog. */
  discardPrompt: {
    onDiscard: () => void;
    onOpenChange: (open: boolean) => void;
    open: boolean;
  };
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
};

type FormGuardContextValue = {
  ancestors: Array<FormGuardStore>;
  store: FormGuardStore;
};

const FormGuardContext = createContext<FormGuardContextValue | null>(null);

/**
 * Every store from the nearest provider up to the stack root. Submit locks
 * and leave permission apply to the whole stack: a successful save inside a
 * nested editor must also unblock the parent overlay's dismiss and
 * navigation guard. Empty outside any provider.
 */
function useFormGuardStack(): Array<FormGuardStore> {
  const ctx = useContext(FormGuardContext);
  return ctx ? [ctx.store, ...ctx.ancestors] : [];
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
    discardPrompt: {
      onDiscard: store.discard,
      onOpenChange: (open) => {
        if (!open) {
          store.keepEditing();
        }
      },
      open: promptOpen,
    },
    rootProps: {
      actionsRef: store.actionsRef,
      onOpenChange: (open, eventDetails) => {
        if (store.handleOpenChange(open, eventDetails) === "allow") {
          opts.onOpenChange?.(open, eventDetails);
        }
      },
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
 * "unsaved edits" signal that blocks leaving. Effect cleanup clears the
 * slot on unmount.
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
    return () => {
      for (const store of stores) {
        store.setFormState(id, null);
      }
    };
  }, [id, stores, isDirty, isSubmitting, isSubmitSuccessful]);
}
