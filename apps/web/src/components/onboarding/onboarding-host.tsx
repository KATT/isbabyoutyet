import { useMutation, useQuery } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { useEffect, useState } from "react";
import { authClient } from "@/lib/auth-client";
import { GettingStartedCard } from "./getting-started";
import { WelcomeTourDialog } from "./welcome-tour";
import { Coachmark } from "./coachmark";
import { ONBOARDING_STEPS } from "./steps";

type OnboardingHostProps = {
  surface: "dashboard" | "baby";
  /** Baby-page owners only — visitors never see the tour */
  enabled?: boolean;
  /** Hide spotlight tips (e.g. while a modal is open) */
  spotlight?: boolean;
};

/**
 * Owns the first-run welcome carousel + floating checklist + one active coachmark.
 * Mount on authenticated surfaces (dashboard) and owner baby pages.
 */
export function OnboardingHost(props: OnboardingHostProps) {
  const enabled = props.enabled !== false;
  const spotlight = props.spotlight !== false;
  const session = authClient.useSession();
  const isAuthed = !!session.data?.user;
  const progress = useQuery(api.onboarding.getMine, isAuthed && enabled ? {} : "skip");
  const dismissWelcome = useMutation(api.onboarding.dismissWelcome);
  const setMinimized = useMutation(api.onboarding.setMinimized);
  const dismissChecklist = useMutation(api.onboarding.dismissChecklist);
  const completeStep = useMutation(api.onboarding.completeStep);

  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const [coachmarkHidden, setCoachmarkHidden] = useState(false);

  // Open welcome once progress loads — skip if already dismissed or they already have a baby
  useEffect(() => {
    if (!progress) return;
    if (progress.welcomeDismissed) return;
    if (progress.hasBaby) {
      void dismissWelcome({});
      return;
    }
    setWelcomeOpen(true);
  }, [progress, dismissWelcome]);

  // Reset coachmark hide when the active step changes
  const nextStep = progress
    ? ONBOARDING_STEPS.find((step) => !progress.effectiveSteps.includes(step.id))
    : undefined;

  useEffect(() => {
    setCoachmarkHidden(false);
  }, [nextStep?.id]);

  if (!enabled || !isAuthed || !progress) {
    return null;
  }

  const showChecklist = progress.welcomeDismissed && !progress.checklistDismissed;
  const showCoachmark =
    spotlight &&
    showChecklist &&
    !progress.minimized &&
    !coachmarkHidden &&
    nextStep &&
    (nextStep.surface === "any" || nextStep.surface === props.surface);

  return (
    <>
      <WelcomeTourDialog
        open={welcomeOpen}
        onOpenChange={setWelcomeOpen}
        onFinished={() => {
          void dismissWelcome({});
        }}
      />

      {showChecklist ? (
        <GettingStartedCard
          effectiveSteps={progress.effectiveSteps}
          minimized={progress.minimized}
          onMinimize={(minimized) => {
            void setMinimized({ minimized });
          }}
          onDismiss={() => {
            void dismissChecklist({});
          }}
          onAcknowledgeStep={(stepId) => {
            void completeStep({ stepId });
          }}
          surface={props.surface}
        />
      ) : null}

      {showCoachmark && nextStep ? (
        <Coachmark
          targetId={nextStep.targetId}
          title={nextStep.title}
          description={nextStep.description}
          completeOnDismiss={nextStep.id === "learn_encouragements"}
          onComplete={() => {
            void completeStep({ stepId: nextStep.id });
          }}
          onDismiss={() => setCoachmarkHidden(true)}
        />
      ) : null}
    </>
  );
}

/** Mark a tour step complete from UI actions (share, settings open, …). */
export function useCompleteOnboardingStep() {
  const completeStep = useMutation(api.onboarding.completeStep);
  return completeStep;
}
