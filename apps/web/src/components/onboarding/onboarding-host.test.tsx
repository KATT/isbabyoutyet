import { fireEvent } from "@testing-library/react";
import { QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, type ConvexReactClient } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import type { OnboardingStepId } from "@workspace/convex/src/onboardingSteps";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { LocaleProvider } from "@/lib/i18n";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby, signUpTestUser } from "@/test/convexTestSeed";
import { renderWithConvexTest } from "@/test/renderWithConvexTest";
import { renderWithTestRouter } from "@/test/renderWithTestRouter";
import { OnboardingHostWithSession, useCompleteOnboardingStep } from "./onboarding-host";

async function renderOnboardingHost(opts: {
  harness: Awaited<ReturnType<typeof createConvexTestHarness>>;
  surface: "dashboard" | "baby";
  babyPublicId: string | undefined;
  session: { data: { user: { id: string } } | null; isPending: boolean };
  onGoToStep: ((stepId: OnboardingStepId) => void) | undefined;
}) {
  const onboarding = await opts.harness.convexPreloader.ensureQueryData(api.onboarding.getMine, {});
  return await renderWithTestRouter(
    <QueryClientProvider client={opts.harness.queryClient}>
      <ConvexProvider client={opts.harness.convexClient as unknown as ConvexReactClient}>
        <LocaleProvider locale="en-GB">
          <OnboardingHostWithSession
            surface={opts.surface}
            onboarding={onboarding}
            enabled={undefined}
            spotlight={undefined}
            babyPublicId={opts.babyPublicId}
            onGoToStep={opts.onGoToStep}
            session={opts.session}
          />
        </LocaleProvider>
      </ConvexProvider>
    </QueryClientProvider>,
    { path: "/" },
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

async function seedAllOnboardingStepsDone(
  harness: Awaited<ReturnType<typeof createConvexTestHarness>>,
  babyId: Awaited<ReturnType<typeof seedOwnedBaby>>["babyId"],
) {
  await harness.client.mutation(api.updates.post, {
    babyId,
    message: "First update",
  });
  for (const stepId of ["share_link", "explore_settings", "learn_encouragements"] as const) {
    await harness.client.mutation(api.onboarding.completeStep, { stepId });
  }
}

test("returns null for anonymous visitors", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const onboarding = await harness.convexPreloader.ensureQueryData(api.onboarding.getMine, {});

  await using view = renderWithConvexTest({
    harness,
    ui: (
      <OnboardingHostWithSession
        surface="dashboard"
        onboarding={onboarding}
        enabled={undefined}
        spotlight={undefined}
        babyPublicId={undefined}
        onGoToStep={undefined}
        session={{ data: null, isPending: false }}
      />
    ),
    wrap: null,
  });

  expect(view.queryByText(/getting started/i)).toBeNull();
  expect(view.queryByRole("button", { name: "Dismiss guide" })).toBeNull();
});

test("shows the checklist on first run without a welcome dialog", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });

  await using view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  expect(view.getAllByText("Add your first baby").length).toBeGreaterThan(0);
  expect(view.queryByRole("dialog", { name: /welcome/i })).toBeNull();
});

test("mounts authed onboarding host when progress is loaded", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  expect(view.getAllByText(/getting started/i).length).toBeGreaterThan(0);
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

  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  fireEvent.click(view.getAllByRole("button", { name: "Dismiss guide" })[0]!);
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.checklistDismissed).toBe(true);
  });
  await vi.waitFor(() => {
    expect(view.getByText("Guide dismissed")).toBeTruthy();
  });
  expect(scrollTo).toHaveBeenCalledWith({ top: 0, behavior: "auto" });

  fireEvent.click(view.getByRole("button", { name: "Hide tip" }));
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.restartHintVisible).toBe(false);
  });
});

test("renders on the tour baby page when babyPublicId matches", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  const baby = await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "baby",
    babyPublicId: baby.publicId,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  expect(view.getAllByText(/share the link/i).length).toBeGreaterThan(0);
});

test("keeps the coachmark tip hidden until a tip target is activated", async () => {
  await using _target = plantTourTarget("share_link");

  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  const baby = await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "baby",
    babyPublicId: baby.publicId,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  expect(view.queryByRole("button", { name: "Hide tip" })).toBeNull();
  expect(view.getAllByRole("link", { name: /show share/i }).length).toBeGreaterThan(0);
  expect(view.getAllByRole("button", { name: "Dismiss guide" }).length).toBeGreaterThan(0);
});

test("returns null on a non-tour baby page", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "baby",
    babyPublicId: "other-baby",
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  expect(view.queryByText(/getting started/i)).toBeNull();
});

test("auto-dismisses the checklist shortly after all steps are done", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });

  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  const baby = await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });
  await seedAllOnboardingStepsDone(harness, baby.babyId);

  await using _view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  await vi.advanceTimersByTimeAsync(4000);
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.checklistDismissed).toBe(true);
  });
});

test("auto-dismiss timer survives progress re-renders", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });

  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  const baby = await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });
  await seedAllOnboardingStepsDone(harness, baby.babyId);

  await using _view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  await vi.advanceTimersByTimeAsync(2000);
  await harness.client.mutation(api.onboarding.setMinimized, { minimized: true });
  await vi.advanceTimersByTimeAsync(2000);

  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.checklistDismissed).toBe(true);
  });
});

test("checklist CTAs complete steps and open baby overlays", async () => {
  const onGoToStep = vi.fn<(stepId: OnboardingStepId) => void>();

  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  const baby = await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.onboarding.completeStep, { stepId: "add_baby" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "baby",
    babyPublicId: baby.publicId,
    onGoToStep,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  fireEvent.click(view.getAllByRole("button", { name: /open settings/i })[0]!);
  expect(onGoToStep).toHaveBeenCalledWith("explore_settings");
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.completedSteps).toContain("explore_settings");
  });

  fireEvent.click(view.getAllByRole("button", { name: "Minimize" })[0]!);
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.minimized).toBe(true);
  });
});

test("messages-from-visitors tip scrolls, highlights, and completes on Got it without posting", async () => {
  await using _target = plantTourTarget("learn_encouragements");

  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  const baby = await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.updates.post, {
    babyId: baby.babyId,
    message: "First update",
  });
  for (const stepId of ["share_link", "explore_settings"] as const) {
    await harness.client.mutation(api.onboarding.completeStep, { stepId });
  }

  const encouragementsBefore = await harness.client.query(api.encouragements.listByBaby, {
    babyId: baby.babyId,
    paginationOpts: { numItems: 20, cursor: null },
  });

  await using view = await renderOnboardingHost({
    harness,
    surface: "baby",
    babyPublicId: baby.publicId,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  fireEvent.click(view.getAllByRole("button", { name: /show me/i })[0]!);
  await vi.waitFor(() => {
    expect(view.getByRole("button", { name: "Got it" })).toBeTruthy();
  });
  expect(view.getByText("Messages from visitors")).toBeTruthy();

  fireEvent.click(view.getByRole("button", { name: "Got it" }));
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.completedSteps).toContain("learn_encouragements");
    expect(progress.activeCoachmarkStepId).toBeNull();
  });

  const encouragementsAfter = await harness.client.query(api.encouragements.listByBaby, {
    babyId: baby.babyId,
    paginationOpts: { numItems: 20, cursor: null },
  });
  expect(encouragementsAfter.page).toEqual(encouragementsBefore.page);
});

test("authed onboarding host wires Convex mutations into the view", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  expect(view.getAllByText(/getting started/i).length).toBeGreaterThan(0);
});

test("useCompleteOnboardingStep returns the Convex mutation", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });

  const holder: {
    completeStep: ((args: { stepId: OnboardingStepId }) => Promise<unknown>) | null;
  } = { completeStep: null };
  function Probe() {
    holder.completeStep = useCompleteOnboardingStep();
    return null;
  }

  await using _view = renderWithConvexTest({
    harness,
    ui: <Probe />,
    wrap: null,
  });

  expect(typeof holder.completeStep).toBe("function");
  await holder.completeStep!({ stepId: "share_link" });
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.completedSteps).toContain("share_link");
  });
});

test("dashboard settings CTA acknowledges the step through the host", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const userId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: userId });
  await seedOwnedBaby(harness, { name: "Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.onboarding.completeStep, { stepId: "add_baby" });
  await harness.client.mutation(api.onboarding.completeStep, { stepId: "share_link" });
  await harness.client.mutation(api.onboarding.completeStep, { stepId: "post_update" });

  await using view = await renderOnboardingHost({
    harness,
    surface: "dashboard",
    babyPublicId: undefined,
    onGoToStep: undefined,
    session: { data: { user: { id: userId } }, isPending: false },
  });

  fireEvent.click(view.getAllByRole("link", { name: /open settings/i })[0]!);
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.completedSteps).toContain("explore_settings");
  });
});
