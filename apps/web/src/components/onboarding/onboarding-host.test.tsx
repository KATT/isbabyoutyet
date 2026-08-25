import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { expect, test, vi } from "vitest";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { LocaleProvider } from "@/lib/i18n";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import {
  OnboardingHostView,
  OnboardingHostWithSession,
  useCompleteOnboardingStep,
} from "./onboarding-host";

type Progress = FunctionReturnType<typeof api.onboarding.getMine>;

const progress: Progress = {
  welcomeDismissed: true,
  checklistDismissed: false,
  minimized: false,
  completedSteps: [] as string[],
  hasBaby: true,
  hasUpdate: false,
  effectiveSteps: ["add_baby"],
  allDone: false,
  tourBaby: { publicId: "baby-smith", name: "Smith" },
};

function resolvedVoid<TArg>() {
  return vi.fn<(arg: TArg) => Promise<unknown>>().mockResolvedValue(null);
}

async function renderView(opts: {
  surface: "dashboard" | "baby";
  progress: Progress;
  babyPublicId: string | undefined;
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
  onSetMinimized: (args: { minimized: boolean }) => Promise<unknown>;
  onDismissChecklist: (args: Record<string, never>) => Promise<unknown>;
  onCompleteStep: (args: { stepId: OnboardingStepId }) => Promise<unknown>;
}) {
  return await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <OnboardingHostView
        surface={opts.surface}
        progress={opts.progress}
        spotlight={undefined}
        babyPublicId={opts.babyPublicId}
        onGoToStep={opts.onGoToStep}
        onSetMinimized={opts.onSetMinimized}
        onDismissChecklist={opts.onDismissChecklist}
        onCompleteStep={opts.onCompleteStep}
      />
    </LocaleProvider>,
  );
}

function plantTourTarget(targetId: string) {
  const el = document.createElement("button");
  el.type = "button";
  el.setAttribute("data-tour-id", targetId);
  el.textContent = targetId;
  el.style.cssText = "position:fixed;top:80px;left:80px;width:40px;height:40px;";
  el.scrollIntoView = () => {};
  el.getBoundingClientRect = () =>
    ({
      x: 80,
      y: 80,
      top: 80,
      left: 80,
      bottom: 120,
      right: 120,
      width: 40,
      height: 40,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(el);
  return makeResource(el, () => {
    el.remove();
  });
}

test("returns null for anonymous visitors", async () => {
  await using _view = await renderWithTestRouter(
    <LocaleProvider locale="en-GB">
      <OnboardingHostWithSession
        surface="dashboard"
        onboarding={testPreloadedConvexQuery<typeof api.onboarding.getMine>({
          input: {},
          initialData: progress,
        })}
        enabled={undefined}
        spotlight={undefined}
        babyPublicId={undefined}
        onGoToStep={undefined}
        session={{ data: null, isPending: false }}
      />
    </LocaleProvider>,
  );

  expect(screen.queryByText(/getting started/i)).toBeNull();
  expect(screen.queryByRole("button", { name: "Dismiss guide" })).toBeNull();
});

test("shows the checklist on first run without a welcome dialog", async () => {
  const firstRun: Progress = {
    ...progress,
    welcomeDismissed: false,
    hasBaby: false,
    effectiveSteps: [] as string[],
    tourBaby: null,
  };

  await using view = await renderView({
    surface: "dashboard",
    progress: firstRun,
    babyPublicId: undefined,
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist: resolvedVoid<Record<string, never>>(),
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  expect(screen.getAllByText("Add your first baby").length).toBeGreaterThan(0);
  expect(view.queryByRole("dialog", { name: /welcome/i })).toBeNull();
});

test("mounts authed onboarding host when progress is loaded", async () => {
  await using _view = await renderView({
    surface: "dashboard",
    progress,
    babyPublicId: undefined,
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist: resolvedVoid<Record<string, never>>(),
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  expect(screen.getAllByText(/getting started/i).length).toBeGreaterThan(0);
});

test("highlights how to restore the guide after dismissal", async () => {
  const scrollTo = vi.fn<(options: ScrollToOptions) => void>();
  const scrollToDescriptor = Object.getOwnPropertyDescriptor(window, "scrollTo");
  await using _scrollTo = makeResource({}, () => {
    if (scrollToDescriptor) {
      Object.defineProperty(window, "scrollTo", scrollToDescriptor);
    } else {
      Reflect.deleteProperty(window, "scrollTo");
    }
  });
  Object.defineProperty(window, "scrollTo", {
    configurable: true,
    value: scrollTo,
  });
  await using _target = plantTourTarget("restart_tour");
  const onDismissChecklist = resolvedVoid<Record<string, never>>();

  await using _view = await renderView({
    surface: "dashboard",
    progress,
    babyPublicId: undefined,
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist,
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  fireEvent.click(screen.getAllByRole("button", { name: "Dismiss guide" })[0]!);
  expect(onDismissChecklist).toHaveBeenCalledWith({});
  await vi.waitFor(() => {
    expect(screen.getByText("Guide dismissed")).toBeTruthy();
  });
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });
});

test("renders on the tour baby page when babyPublicId matches", async () => {
  await using _view = await renderView({
    surface: "baby",
    progress,
    babyPublicId: "baby-smith",
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist: resolvedVoid<Record<string, never>>(),
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  expect(screen.getAllByText(/share the link/i).length).toBeGreaterThan(0);
});

test("keeps the coachmark tip hidden until a tip target is activated", async () => {
  await using _target = plantTourTarget("share_link");

  await using _view = await renderView({
    surface: "baby",
    progress,
    babyPublicId: "baby-smith",
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist: resolvedVoid<Record<string, never>>(),
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  // Checklist is up; the share step CTA is a link into the share overlay, so
  // no coachmark tip is shown until something else activates one.
  expect(screen.queryByRole("button", { name: "Hide tip" })).toBeNull();
  expect(screen.getAllByRole("link", { name: /show share/i }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button", { name: "Dismiss guide" }).length).toBeGreaterThan(0);
});

test("returns null on a non-tour baby page", async () => {
  await using _view = await renderView({
    surface: "baby",
    progress,
    babyPublicId: "other-baby",
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist: resolvedVoid<Record<string, never>>(),
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  expect(screen.queryByText(/getting started/i)).toBeNull();
});

test("auto-dismisses the checklist shortly after all steps are done", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  const onDismissChecklist = resolvedVoid<Record<string, never>>();

  await using _view = await renderView({
    surface: "dashboard",
    progress: { ...progress, allDone: true, checklistDismissed: false },
    babyPublicId: undefined,
    onGoToStep: undefined,
    onSetMinimized: resolvedVoid<{ minimized: boolean }>(),
    onDismissChecklist,
    onCompleteStep: resolvedVoid<{ stepId: OnboardingStepId }>(),
  });

  await vi.advanceTimersByTimeAsync(4000);
  expect(onDismissChecklist).toHaveBeenCalledWith({});
});

test("checklist CTAs complete steps and open baby overlays", async () => {
  const onGoToStep = vi.fn<(stepId: OnboardingStepId) => void>();
  const onCompleteStep = resolvedVoid<{ stepId: OnboardingStepId }>();
  const onSetMinimized = resolvedVoid<{ minimized: boolean }>();

  await using _view = await renderView({
    surface: "baby",
    progress: {
      ...progress,
      effectiveSteps: ["add_baby", "share_link"],
      hasUpdate: false,
    },
    babyPublicId: "baby-smith",
    onGoToStep,
    onSetMinimized,
    onDismissChecklist: resolvedVoid<Record<string, never>>(),
    onCompleteStep,
  });

  fireEvent.click(screen.getAllByRole("button", { name: /open settings/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("explore_settings");
  expect(onCompleteStep).toHaveBeenCalledWith({ stepId: "explore_settings" });

  fireEvent.click(screen.getAllByRole("button", { name: "Minimize" })[0]!);
  expect(onSetMinimized).toHaveBeenCalledWith({ minimized: true });
});


test("authed onboarding host wires Convex mutations into the view", async () => {
  const client = new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });

  await using _view = await renderWithTestRouter(
    <QueryClientProvider client={queryClient}>
      <ConvexProvider client={client}>
        <LocaleProvider locale="en-GB">
          <OnboardingHostWithSession
            surface="dashboard"
            onboarding={testPreloadedConvexQuery<typeof api.onboarding.getMine>({
              input: {},
              initialData: progress,
            })}
            enabled={undefined}
            spotlight={undefined}
            babyPublicId={undefined}
            onGoToStep={undefined}
            session={{ data: { user: { id: "user-1" } }, isPending: false }}
          />
        </LocaleProvider>
      </ConvexProvider>
    </QueryClientProvider>,
  );

  expect(screen.getAllByText(/getting started/i).length).toBeGreaterThan(0);
});

test("useCompleteOnboardingStep returns the Convex mutation", async () => {
  const client = new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
  await using _client = makeAsyncResource(client, async () => {
    await client.close();
  });

  let completeStep: unknown = null;
  function Probe() {
    completeStep = useCompleteOnboardingStep();
    return null;
  }

  const view = render(
    <ConvexProvider client={client}>
      <Probe />
    </ConvexProvider>,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  expect(typeof completeStep).toBe("function");
});
