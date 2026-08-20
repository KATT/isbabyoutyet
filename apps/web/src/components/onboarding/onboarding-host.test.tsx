import { fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";

const mocks = vi.hoisted(() => ({
  useSuspenseQuery: vi.fn<() => { data: unknown }>(),
  useSession: vi.fn<() => { data: { user: { id: string } } | null; isPending: boolean }>(),
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
      if (index % 3 === 0) return mocks.setMinimized;
      if (index % 3 === 1) return mocks.dismissChecklist;
      return mocks.completeStep;
    };
  })(),
}));

vi.mock("./getting-started", () => ({
  GettingStartedCard: (props: {
    onGoToStep: ((stepId: "share_link") => void) | undefined;
    onDismiss: () => void;
  }) => (
    <div data-testid="getting-started">
      <button
        type="button"
        onClick={() => {
          if (props.onGoToStep) {
            props.onGoToStep("share_link");
          }
        }}
      >
        Show Share
      </button>
      <button type="button" onClick={props.onDismiss}>
        Dismiss guide
      </button>
    </div>
  ),
}));

vi.mock("./coachmark", () => ({
  Coachmark: (props: { targetId: string }) => <div data-testid="coachmark">{props.targetId}</div>,
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

test("shows the checklist on first run without a welcome dialog", async () => {
  const firstRun = {
    ...progress,
    welcomeDismissed: false,
    hasBaby: false,
    effectiveSteps: [] as string[],
    tourBaby: null,
  };
  mocks.useSession.mockReturnValue({
    data: { user: { id: "user-1" } },
    isPending: false,
  });
  mocks.useSuspenseQuery.mockReturnValue({ data: firstRun });

  await using view = renderResource(
    <OnboardingHost
      surface="dashboard"
      onboarding={testPreloadedConvexQuery<typeof api.onboarding.getMine>({
        input: {},
        initialData: firstRun,
      })}
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  expect(view.getByTestId("getting-started")).toBeTruthy();
  expect(view.queryByRole("dialog")).toBeNull();
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

test("highlights how to restore the guide after dismissal", async () => {
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

  fireEvent.click(view.getByRole("button", { name: "Dismiss guide" }));
  expect(mocks.dismissChecklist).toHaveBeenCalledWith({});
  await vi.waitFor(() => {
    expect(view.getByTestId("coachmark").textContent).toBe("restart_tour");
  });
  expect(view.queryByTestId("getting-started")).toBeNull();
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

test("shows a coachmark only after the user asks for contextual help", async () => {
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

  expect(view.queryByTestId("coachmark")).toBeNull();
  fireEvent.click(view.getByRole("button", { name: "Show Share" }));
  expect(view.getByTestId("coachmark").textContent).toBe("share_link");
  expect(view.queryByTestId("getting-started")).toBeNull();
});
