import { act, fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const mocks = vi.hoisted(() => ({
  useSuspenseQuery: vi.fn<() => { data: unknown }>(),
  useSession: vi.fn<() => { data: { user: { id: string } } | null; isPending: boolean }>(),
  dismissWelcome: vi.fn<() => void>(),
  setMinimized: vi.fn<() => void>(),
  dismissChecklist: vi.fn<() => void>(),
  completeStep: vi.fn<() => void>(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => mocks.useSession(),
  },
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useSuspenseQuery: () => mocks.useSuspenseQuery(),
  };
});

vi.mock("convex/react", () => ({
  useMutation: (() => {
    let call = 0;
    return () => {
      const index = call;
      call += 1;
      if (index % 4 === 0) return mocks.dismissWelcome;
      if (index % 4 === 1) return mocks.setMinimized;
      if (index % 4 === 2) return mocks.dismissChecklist;
      return mocks.completeStep;
    };
  })(),
}));

vi.mock("./welcome-tour", () => ({
  WelcomeTourDialog: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onFinished: () => void;
  }) =>
    props.open ? (
      <button
        type="button"
        onClick={() => {
          props.onFinished();
          props.onOpenChange(false);
        }}
      >
        Finish welcome
      </button>
    ) : null,
}));

vi.mock("./getting-started", () => ({
  GettingStartedCard: () => <div data-testid="getting-started" />,
}));

vi.mock("./coachmark", () => ({
  Coachmark: () => null,
}));

const { OnboardingHost } = await import("./onboarding-host");
const { testPreloadedConvexQuery } = await import("@workspace/convex-prefetch/test-helpers");
const { api } = await import("@workspace/convex/convex/_generated/api");

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

const progress = {
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

const onboardingHandle = testPreloadedConvexQuery<typeof api.onboarding.getMine>({
  input: {},
  initialData: progress,
});

test("returns null for anonymous visitors", async () => {
  mocks.useSession.mockReturnValue({ data: null, isPending: false });

  await using view = renderResource(
    <OnboardingHost
      surface="dashboard"
      onboarding={onboardingHandle}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  expect(view.container.firstChild).toBeNull();
});

test("mounts authed onboarding host when progress is loaded", async () => {
  mocks.useSession.mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  });
  mocks.useSuspenseQuery.mockReturnValue({ data: progress });

  await using view = renderResource(
    <OnboardingHost
      surface="dashboard"
      onboarding={onboardingHandle}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  expect(view.getByTestId("getting-started")).toBeTruthy();
});

test("renders on the tour baby page when babyPublicId matches", async () => {
  mocks.useSession.mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  });
  mocks.useSuspenseQuery.mockReturnValue({ data: progress });

  await using view = renderResource(
    <OnboardingHost
      surface="baby"
      onboarding={onboardingHandle}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId="baby-smith"
      onGoToStep={undefined}
    />,
  );

  expect(view.getByTestId("getting-started")).toBeTruthy();
});

test("dismisses a completed checklist after four seconds", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => vi.useRealTimers());
  mocks.dismissChecklist.mockClear();
  mocks.useSession.mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  });
  mocks.useSuspenseQuery.mockReturnValue({
    data: {
      ...progress,
      effectiveSteps: ["add_baby", "share_link", "post_update", "explore_settings"],
      allDone: true,
    },
  });

  await using _view = renderResource(
    <OnboardingHost
      surface="dashboard"
      onboarding={onboardingHandle}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  act(() => vi.advanceTimersByTime(3999));
  expect(mocks.dismissChecklist).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(mocks.dismissChecklist).toHaveBeenCalledOnce();
});

test("persists a skipped welcome tour when the user already has a baby", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => vi.useRealTimers());
  mocks.dismissWelcome.mockClear();
  mocks.useSession.mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  });
  mocks.useSuspenseQuery.mockReturnValue({
    data: {
      ...progress,
      welcomeDismissed: false,
    },
  });

  await using _view = renderResource(
    <OnboardingHost
      surface="dashboard"
      onboarding={onboardingHandle}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  act(() => vi.advanceTimersByTime(0));
  expect(mocks.dismissWelcome).toHaveBeenCalledOnce();
});

test("closes the welcome tour immediately while persisting dismissal", async () => {
  mocks.dismissWelcome.mockClear();
  mocks.useSession.mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  });
  mocks.useSuspenseQuery.mockReturnValue({
    data: {
      ...progress,
      welcomeDismissed: false,
      hasBaby: false,
    },
  });

  await using view = renderResource(
    <OnboardingHost
      surface="dashboard"
      onboarding={onboardingHandle}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  fireEvent.click(view.getByRole("button", { name: "Finish welcome" }));
  expect(view.queryByRole("button", { name: "Finish welcome" })).toBeNull();
  expect(mocks.dismissWelcome).toHaveBeenCalledOnce();
});
