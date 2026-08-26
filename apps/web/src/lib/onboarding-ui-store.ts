import { useRef, useSyncExternalStore } from "react";
import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";

type OnboardingUiSnapshot = {
  activeCoachmarkStepId: OnboardingStepId | null;
  restartHintVisible: boolean;
};

type OnboardingUiStore = {
  subscribe: (notify: () => void) => () => void;
  getSnapshot: () => OnboardingUiSnapshot;
  setActiveCoachmarkStepId: (stepId: OnboardingStepId | null) => void;
  setRestartHintVisible: (visible: boolean) => void;
};

function getServerSnapshot(): OnboardingUiSnapshot {
  return {
    activeCoachmarkStepId: null,
    restartHintVisible: false,
  };
}

function createOnboardingUiStore(): OnboardingUiStore {
  const listeners = new Set<() => void>();
  let snapshot: OnboardingUiSnapshot = {
    activeCoachmarkStepId: null,
    restartHintVisible: false,
  };

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function patch(partial: Partial<OnboardingUiSnapshot>) {
    snapshot = { ...snapshot, ...partial };
    emit();
  }

  return {
    subscribe(notify) {
      listeners.add(notify);
      return () => {
        listeners.delete(notify);
      };
    },
    getSnapshot() {
      return snapshot;
    },
    setActiveCoachmarkStepId(stepId) {
      patch({ activeCoachmarkStepId: stepId });
    },
    setRestartHintVisible(visible) {
      patch({ restartHintVisible: visible });
    },
  };
}

/**
 * Per-mount store for ephemeral coachmark / restart-hint UI. Lives in lib so
 * the host can use useSyncExternalStore instead of feature useState.
 */
export function useOnboardingUiStore() {
  const storeRef = useRef<OnboardingUiStore | null>(null);
  if (!storeRef.current) {
    storeRef.current = createOnboardingUiStore();
  }
  const store = storeRef.current;
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerSnapshot);
  return { snapshot, store };
}
