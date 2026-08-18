import { useMutation } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import { useCallback, useState } from "react";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import type { InitiatedConvexQuery, PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useDelayedAction } from "@/lib/use-delayed-action";
import { GettingStartedCard } from "./getting-started";
import { WelcomeTourDialog } from "./welcome-tour";
import { Coachmark } from "./coachmark";
import { ONBOARDING_STEPS } from "./steps";

type OnboardingHostProps = {
  surface: "dashboard" | "baby";
  onboarding:
    | PreloadedConvexQuery<typeof api.onboarding.getMine>
    | InitiatedConvexQuery<typeof api.onboarding.getMine>;
  /** Baby-page owners only — visitors never see the tour */
  enabled: boolean | undefined;
  /** Hide spotlight tips (e.g. while a modal is open) */
  spotlight: boolean | undefined;
  /** When set, the baby-page tour only runs on the first created baby */
  babyPublicId: string | undefined;
  /** Baby-page: open post-update / settings from the checklist */
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
};

function WelcomeTourController(props: { onFinished: () => void; visible: boolean }) {
  const [open, setOpen] = useState(props.visible);
  return (
    <WelcomeTourDialog
      open={props.visible && open}
      onOpenChange={setOpen}
      onFinished={props.onFinished}
    />
  );
}

function scrollToTourTarget(targetId: string) {
  const el = document.querySelector(`[data-tour-id="${targetId}"]`);
  if (!(el instanceof HTMLElement)) {
    return;
  }
  el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
}

/**
 * Owns the first-run welcome carousel + floating checklist + one active coachmark.
 * Mount on the dashboard index (not /dashboard/add) and the first baby's owner page.
 *
 * Auth-gated: only mounts the suspense query once the session is known so
 * anonymous visitors never suspend on `onboarding.getMine`.
 */
export function OnboardingHost(props: OnboardingHostProps) {
  const enabled = props.enabled !== false;
  const session = authClient.useSession();
  const isAuthed = !!session.data?.user;

  if (!enabled || !isAuthed || session.isPending) {
    return null;
  }

  return <OnboardingHostAuthed {...props} />;
}

function OnboardingHostAuthed(props: OnboardingHostProps) {
  const { t } = useI18n();
  const spotlight = props.spotlight !== false;
  const progressQuery = usePreloadedConvexQuery(api.onboarding.getMine, props.onboarding);
  const progress = progressQuery.data;
  const dismissWelcome = useMutation(api.onboarding.dismissWelcome);
  const setMinimized = useMutation(api.onboarding.setMinimized);
  const dismissChecklist = useMutation(api.onboarding.dismissChecklist);
  const completeStep = useMutation(api.onboarding.completeStep);

  const [hiddenCoachmarkStep, setHiddenCoachmarkStep] = useState<OnboardingStepId | null>(null);

  const nextStep = ONBOARDING_STEPS.find((step) => !progress.effectiveSteps.includes(step.id));
  const dismissSkippedWelcome = useCallback(() => {
    void dismissWelcome({});
  }, [dismissWelcome]);
  useDelayedAction({
    action: dismissSkippedWelcome,
    delayMs: 0,
    enabled: progress.hasBaby && !progress.welcomeDismissed,
  });
  const dismissFinishedChecklist = useCallback(() => {
    void dismissChecklist({});
  }, [dismissChecklist]);
  useDelayedAction({
    action: dismissFinishedChecklist,
    delayMs: 4000,
    enabled: progress.allDone && !progress.checklistDismissed,
  });

  const isTourBabyPage =
    props.surface !== "baby" ||
    (progress.tourBaby != null && progress.tourBaby.publicId === props.babyPublicId);

  if (!isTourBabyPage) {
    return null;
  }

  const welcomeComplete = progress.welcomeDismissed || progress.hasBaby;
  const showWelcome = !welcomeComplete;
  const showChecklist = welcomeComplete && !progress.checklistDismissed;
  const highlightBabyCard =
    props.surface === "dashboard" && nextStep?.surface === "baby" && progress.tourBaby != null;
  const showCoachmark =
    spotlight &&
    showChecklist &&
    !progress.minimized &&
    hiddenCoachmarkStep !== nextStep?.id &&
    nextStep &&
    (nextStep.surface === props.surface || highlightBabyCard);

  const coachmarkTargetId = highlightBabyCard ? "tour_baby" : nextStep?.targetId;
  const coachmarkTitle = nextStep ? t(nextStep.title) : "";
  const coachmarkDescription = highlightBabyCard
    ? t("Open {{name}}'s page to do this — or tap the step in the checklist.", {
        name: progress.tourBaby?.name ?? "baby",
      })
    : nextStep
      ? t(nextStep.description)
      : "";

  function handleGoToStep(stepId: OnboardingStepId) {
    if (stepId === "post_update") {
      props.onGoToStep?.(stepId);
      return;
    }
    if (stepId === "explore_settings") {
      props.onGoToStep?.(stepId);
      void completeStep({ stepId });
      return;
    }
    const step = ONBOARDING_STEPS.find((item) => item.id === stepId);
    if (step) {
      scrollToTourTarget(step.targetId);
    }
  }

  return (
    <>
      <WelcomeTourController
        key={showWelcome ? "visible" : "hidden"}
        visible={showWelcome}
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
          onGoToStep={handleGoToStep}
          surface={props.surface}
          tourBaby={progress.tourBaby}
          className={undefined}
        />
      ) : null}

      {showCoachmark && nextStep && coachmarkTargetId && coachmarkDescription ? (
        <Coachmark
          targetId={coachmarkTargetId}
          title={coachmarkTitle}
          description={coachmarkDescription}
          completeOnDismiss={nextStep.id === "learn_encouragements"}
          onComplete={() => {
            void completeStep({ stepId: nextStep.id });
          }}
          onDismiss={() => setHiddenCoachmarkStep(nextStep.id)}
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
