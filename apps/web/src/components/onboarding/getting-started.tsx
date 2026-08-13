import { Button } from "@workspace/ui/components/button";
import { Progress, ProgressLabel, ProgressValue } from "@workspace/ui/components/progress";
import { cn } from "@workspace/ui/lib/utils";
import { Check, ChevronDown, ChevronUp, Sparkles, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import type { OnboardingStepCopy } from "./steps";
import { ONBOARDING_STEPS } from "./steps";

type GettingStartedCardProps = {
  effectiveSteps: string[];
  minimized: boolean;
  onMinimize: (minimized: boolean) => void;
  onDismiss: () => void;
  onAcknowledgeStep: (stepId: string) => void;
  /** Current route context for CTAs */
  surface: "dashboard" | "baby";
  className?: string;
};

export function GettingStartedCard(props: GettingStartedCardProps) {
  const done = new Set(props.effectiveSteps);
  const completedCount = ONBOARDING_STEPS.filter((step) => done.has(step.id)).length;
  const total = ONBOARDING_STEPS.length;
  const percent = Math.round((completedCount / total) * 100);
  const nextStep = ONBOARDING_STEPS.find((step) => !done.has(step.id));
  const allDone = !nextStep;

  if (props.minimized) {
    return (
      <button
        type="button"
        onClick={() => props.onMinimize(false)}
        className={cn(
          "fixed z-40 flex items-center gap-2 rounded-full border border-primary/20 bg-popover/95 px-3 py-2 text-sm font-medium shadow-lg ring-1 ring-foreground/10 backdrop-blur-sm transition hover:border-primary/40",
          "right-4 bottom-6",
          props.className,
        )}
        aria-label={`Getting started: ${completedCount} of ${total} done. Expand.`}
      >
        <span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-primary">
          <Sparkles className="size-3.5" />
        </span>
        <span className="tabular-nums text-foreground">
          {completedCount}/{total}
        </span>
        <ChevronUp className="size-4 text-muted-foreground" />
      </button>
    );
  }

  return (
    <aside
      className={cn(
        "fixed z-40 w-[min(100%-2rem,22rem)] rounded-xl border border-border/60 bg-popover/95 p-4 shadow-xl ring-1 ring-foreground/10 backdrop-blur-md",
        "right-4 bottom-6",
        "animate-in fade-in-0 slide-in-from-bottom-2 duration-200",
        props.className,
      )}
      aria-label="Getting started checklist"
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex size-8 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Sparkles className="size-4" />
          </span>
          <div>
            <p className="text-sm font-semibold text-foreground">Getting started</p>
            <p className="text-xs text-muted-foreground">
              {allDone ? "You're all set" : "A quick tour of the basics"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Minimize"
            onClick={() => props.onMinimize(true)}
          >
            <ChevronDown />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dismiss tour"
            onClick={props.onDismiss}
          >
            <X />
          </Button>
        </div>
      </div>

      <Progress value={percent} className="mb-3">
        <ProgressLabel className="sr-only">Tour progress</ProgressLabel>
        <ProgressValue />
      </Progress>

      <ul className="flex flex-col gap-1.5 mb-3">
        {ONBOARDING_STEPS.map((step) => {
          const isDone = done.has(step.id);
          const isNext = nextStep?.id === step.id;
          return (
            <li
              key={step.id}
              className={cn(
                "flex items-start gap-2 rounded-lg px-2 py-1.5 text-sm",
                isNext && "bg-primary/8 ring-1 ring-primary/15",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                  isDone
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-muted-foreground/30",
                )}
              >
                {isDone ? <Check className="size-2.5" /> : null}
              </span>
              <span className={cn("leading-snug", isDone && "text-muted-foreground line-through")}>
                {step.title}
              </span>
            </li>
          );
        })}
      </ul>

      {nextStep ? (
        <NextStepHint
          step={nextStep}
          surface={props.surface}
          onAcknowledge={() => props.onAcknowledgeStep(nextStep.id)}
        />
      ) : (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted-foreground">
            Nice work — share your page and enjoy the quiet inbox.
          </p>
          <Button size="sm" variant="outline" onClick={props.onDismiss}>
            Close checklist
          </Button>
        </div>
      )}
    </aside>
  );
}

function NextStepHint(props: {
  step: OnboardingStepCopy;
  surface: "dashboard" | "baby";
  onAcknowledge: () => void;
}) {
  const Icon = props.step.icon;
  const showDashboardCta = props.step.id === "add_baby" && props.surface === "dashboard";
  const needsBabyPage = props.step.surface === "baby" && props.surface === "dashboard";

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-primary/15 bg-primary/5 p-3">
      <div className="flex items-start gap-2">
        <Icon className="mt-0.5 size-4 shrink-0 text-primary" />
        <div className="flex flex-col gap-1">
          <p className="text-sm font-medium text-foreground">{props.step.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{props.step.description}</p>
          {needsBabyPage ? (
            <p className="text-xs text-muted-foreground">Open a baby page to do this step.</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {showDashboardCta ? (
          <Button
            size="sm"
            render={<Link to="/dashboard/add" preload="viewport" />}
            nativeButton={false}
          >
            {props.step.ctaLabel ?? "Continue"}
          </Button>
        ) : null}
        {/* Educational steps can be acknowledged without a specific click target */}
        {props.step.id === "learn_encouragements" ? (
          <Button size="sm" variant="secondary" onClick={props.onAcknowledge}>
            Got it
          </Button>
        ) : null}
      </div>
    </div>
  );
}
