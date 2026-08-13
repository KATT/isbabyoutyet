import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { useConvexSuspenseQuery } from "@/lib/convex-query";

const mocks = vi.hoisted(() => ({
  useConvexSuspenseQuery:
    vi.fn<
      (
        ...args: Parameters<typeof useConvexSuspenseQuery>
      ) => ReturnType<typeof useConvexSuspenseQuery>
    >(),
  useSession: vi.fn<() => { data: { user: { id: string } } | null; isPending: boolean }>(),
  dismissWelcome: vi.fn(),
  setMinimized: vi.fn(),
  dismissChecklist: vi.fn(),
  completeStep: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
  authClient: {
    useSession: () => mocks.useSession(),
  },
}));

vi.mock("@/lib/convex-query", () => ({
  useConvexSuspenseQuery: mocks.useConvexSuspenseQuery,
  ensureConvexQuery: vi.fn(),
}));

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
  WelcomeTourDialog: () => null,
}));

vi.mock("./getting-started", () => ({
  GettingStartedCard: () => <div data-testid="getting-started" />,
}));

vi.mock("./coachmark", () => ({
  Coachmark: () => null,
}));

const { OnboardingHost } = await import("./onboarding-host");

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
  completedSteps: [],
  hasBaby: true,
  hasUpdate: false,
  effectiveSteps: ["add_baby"],
  allDone: false,
  tourBaby: { publicId: "baby-smith", name: "Smith" },
} as const;

test("returns null for anonymous visitors", async () => {
  mocks.useSession.mockReturnValue({ data: null, isPending: false });

  await using view = renderResource(
    <OnboardingHost
      surface="dashboard"
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
  mocks.useConvexSuspenseQuery.mockReturnValue({
    data: progress,
  } as ReturnType<typeof useConvexSuspenseQuery>);

  await using view = renderResource(
    <OnboardingHost
      surface="dashboard"
      enabled={undefined}
      spotlight={undefined}
      babyPublicId={undefined}
      onGoToStep={undefined}
    />,
  );

  expect(view.getByTestId("getting-started")).toBeTruthy();
});
