import { expect, test } from "vitest";
import {
  optimisticallyCompleteStep,
  optimisticallyDismissChecklist,
  optimisticallySetActiveCoachmarkStepId,
  optimisticallySetMinimized,
  optimisticallySetRestartHintVisible,
  type OnboardingProgress,
} from "./onboarding-optimistic";

const base: OnboardingProgress = {
  welcomeDismissed: false,
  checklistDismissed: false,
  minimized: false,
  completedSteps: [],
  hasBaby: true,
  hasUpdate: false,
  effectiveSteps: ["add_baby"],
  allDone: false,
  tourBaby: { publicId: "juniper", name: "Juniper" },
  activeCoachmarkStepId: "share_link",
  restartHintVisible: false,
};

test("completeStep appends the step, refreshes effectiveSteps, and clears matching coachmark", () => {
  const next = optimisticallyCompleteStep(base, "share_link");
  expect(next.completedSteps).toEqual(["share_link"]);
  expect(next.effectiveSteps).toEqual(["add_baby", "share_link"]);
  expect(next.welcomeDismissed).toBe(true);
  expect(next.activeCoachmarkStepId).toBeNull();
  expect(next.allDone).toBe(false);
});

test("completeStep is a no-op when the step is already completed", () => {
  const started = optimisticallyCompleteStep(base, "share_link");
  expect(optimisticallyCompleteStep(started, "share_link")).toBe(started);
});

test("dismissChecklist hides the tour chrome and clears the open coachmark", () => {
  expect(optimisticallyDismissChecklist(base)).toMatchObject({
    checklistDismissed: true,
    welcomeDismissed: true,
    minimized: true,
    activeCoachmarkStepId: null,
  });
});

test("minimize, coachmark, and restart-hint patches are shallow field updates", () => {
  expect(optimisticallySetMinimized(base, true).minimized).toBe(true);
  expect(optimisticallySetActiveCoachmarkStepId(base, null).activeCoachmarkStepId).toBeNull();
  expect(optimisticallySetRestartHintVisible(base, true).restartHintVisible).toBe(true);
});
