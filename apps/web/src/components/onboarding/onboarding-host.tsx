import { useMutation } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import type { PreloadedConvexQuery } from "@workspace/convex-prefetch";
import { authClient } from "@/lib/auth-client";
import { useI18n } from "@/lib/i18n";
import { useDelayedAction } from "@/lib/use-delayed-action";
import { GettingStartedCard } from "./getting-started";
import { Coachmark } from "./coachmark";
import { ONBOARDING_STEPS } from "./steps";

type OnboardingSession = {
  data: { user: { id: string } } | null;
  isPending: boolean;
};

type OnboardingHostProps = {
  surface: "dashboard" | "baby";
  onboarding: PreloadedConvexQuery<typeof api.onboarding.getMine>;
  /** Baby-page owners only — visitors never see the tour */
  enabled: boolean | undefined;
  /** Hide spotlight tips (e.g. while a modal is open) */
  spotlight: boolean | undefined;
  /** When set, the baby-page tour only runs on the first created baby */
  babyPublicId: string | undefined;
  /** Baby-page: open post-update / settings from the checklist */
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
};

function scrollToTourTarget(targetId: string) {
  const el = document.querySelector(`[data-tour-id="${targetId}"]`);
  if (!(el instanceof HTMLElement) || typeof el.scrollIntoView !== "function") {
    return;
  }
  el.scrollIntoView({ block: "center", behavior: "smooth", inline: "nearest" });
}

/**
 * Owns the first-run floating checklist + one active coachmark.
 * Mount on the dashboard index (not /dashboard/add) and the first baby's owner page.
 *
 * Auth-gated: only mounts the suspense query once the session is known so
 * anonymous visitors never suspend on `onboarding.getMine`.
 */
export function OnboardingHost(props: OnboardingHostProps) {
  const session = authClient.useSession();
  return (
    <OnboardingHostWithSession
      {...props}
      session={{
        data: session.data?.user ? { user: { id: session.data.user.id } } : null,
        isPending: session.isPending,
      }}
    />
  );
}

/**
 * Session-injected gate used by tests. Production goes through {@link OnboardingHost}.
 *
 * @internal exported for tests
 */
export function OnboardingHostWithSession(
  props: OnboardingHostProps & { session: OnboardingSession },
) {
  const enabled = props.enabled !== false;
  const isAuthed = !!props.session.data?.user;

  if (!enabled || !isAuthed || props.session.isPending) {
    return null;
  }

  return <OnboardingHostAuthed {...props} />;
}

function OnboardingHostAuthed(props: OnboardingHostProps) {
  const progressQuery = usePreloadedConvexQuery(api.onboarding.getMine, props.onboarding);
  const setMinimized = useMutation(api.onboarding.setMinimized);
  const dismissChecklist = useMutation(api.onboarding.dismissChecklist);
  const completeStep = useMutation(api.onboarding.completeStep);
  const setActiveCoachmarkStepId = useMutation(api.onboarding.setActiveCoachmarkStepId);
  const setRestartHintVisible = useMutation(api.onboarding.setRestartHintVisible);
  const { t } = useI18n();
  const spotlight = props.spotlight !== false;
  const progress = progressQuery.data;

  function dismissFinishedChecklist() {
    void dismissChecklist({});
  }
  useDelayedAction({
    action: dismissFinishedChecklist,
    delayMs: 4000,
    enabled: progress.allDone && !progress.checklistDismissed,
  });

  const nextStep = ONBOARDING_STEPS.find((step) => !progress.effectiveSteps.includes(step.id));

  const isTourBabyPage =
    props.surface !== "baby" ||
    (progress.tourBaby != null && progress.tourBaby.publicId === props.babyPublicId);

  if (!isTourBabyPage) {
    return null;
  }

  const showChecklist = !progress.checklistDismissed;
  const showCoachmark =
    spotlight &&
    showChecklist &&
    nextStep &&
    progress.activeCoachmarkStepId === nextStep.id &&
    nextStep.surface === props.surface;

  const coachmarkTargetId = nextStep?.targetId;
  const coachmarkTitle = nextStep ? t(nextStep.title) : "";
  const coachmarkDescription = nextStep ? t(nextStep.description) : "";
  const showRestartHint = props.surface === "dashboard" && progress.restartHintVisible;

  return (
    <>
      {showChecklist && !showCoachmark && !showRestartHint ? (
        <GettingStartedCard
          effectiveSteps={progress.effectiveSteps}
          minimized={progress.minimized}
          onMinimize={(minimized) => {
            void setMinimized({ minimized });
          }}
          onDismiss={() => {
            void (async () => {
              await dismissChecklist({});
              if (props.surface === "dashboard") {
                window.scrollTo({ top: 0, behavior: "auto" });
                await setRestartHintVisible({ visible: true });
              }
            })();
          }}
          onAcknowledgeStep={(stepId) => {
            void completeStep({ stepId });
          }}
          onGoToStep={(stepId) => {
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
              void setActiveCoachmarkStepId({ stepId: step.id });
              scrollToTourTarget(step.targetId);
            }
          }}
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
          onDismiss={() => {
            void setActiveCoachmarkStepId({ stepId: null });
          }}
        />
      ) : null}

      {showRestartHint ? (
        <Coachmark
          targetId="restart_tour"
          title={t("Guide dismissed")}
          description={t("Use this sparkle button to bring the guide back anytime.")}
          completeOnDismiss={undefined}
          onComplete={undefined}
          onDismiss={() => {
            void setRestartHintVisible({ visible: false });
          }}
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
