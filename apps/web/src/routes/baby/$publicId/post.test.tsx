import { fireEvent, render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { DEFAULT_MILESTONE_VISIBILITY } from "@workspace/convex/src/types";
import type { ReactElement, ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(options: unknown) => void>(),
  historyBack: vi.fn<() => void>(),
  canGoBack: vi.fn<() => boolean>().mockReturnValue(false),
  historyState: { routeModal: undefined as true | undefined },
  completeStep: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
  params: { publicId: "baby-smith" },
  loaderData: null as null | Record<string, unknown>,
}));

vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({
      options,
      ...options,
      fullPath: "/baby/$publicId/post",
      useParams: () => mocks.params,
      useLoaderData: () => mocks.loaderData,
    }),
    useNavigate: () => mocks.navigate,
    useRouter: () => ({
      history: {
        location: { state: mocks.historyState },
        canGoBack: mocks.canGoBack,
        back: mocks.historyBack,
      },
      navigate: mocks.navigate,
    }),
    notFound: () => {
      throw { isNotFound: true };
    },
    redirect: (opts: unknown) => {
      throw { options: opts };
    },
  };
});

vi.mock("@/components/onboarding/onboarding-host", () => ({
  useCompleteOnboardingStep: () => mocks.completeStep,
}));

vi.mock("@/routes/baby/$publicId/route", () => ({
  managerDocToBabyData: (doc: { name: string }) => ({
    name: doc.name,
    dueDate: null,
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    theme: null,
    locale: null,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    milestoneVisibility: DEFAULT_MILESTONE_VISIBILITY,
    photoId: null,
  }),
}));

vi.mock("@workspace/ui/components/dialog", async () => {
  const React = await import("react");
  function MockDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: ((open: boolean) => void) | undefined;
    children: ReactNode;
  }) {
    const wasOpen = React.useRef(props.open);
    React.useEffect(() => {
      if (wasOpen.current && !props.open) {
        props.onOpenChangeComplete?.(false);
      }
      wasOpen.current = props.open;
    }, [props.open, props.onOpenChangeComplete]);
    return (
      <div data-testid="dialog" data-open={props.open}>
        <button
          type="button"
          onClick={() => {
            props.onOpenChange(false);
          }}
        >
          dismiss
        </button>
        {props.children}
      </div>
    );
  }
  return {
    Dialog: MockDialog,
    DialogContent: (props: { children: ReactNode }) => <div>{props.children}</div>,
    DialogTitle: (props: { children: ReactNode }) => <h2>{props.children}</h2>,
  };
});

vi.mock("@/components/baby/timeline", () => ({
  UpdateComposer: (props: { onPosted: () => void; babyName: string }) => (
    <button type="button" onClick={() => props.onPosted()}>
      post for {props.babyName}
    </button>
  ),
}));

const routeModule = await import("@/routes/baby/$publicId/post");
const { BabyPostUpdateOverlay } = routeModule;

function makeLoaderQueryClient(handlers: Record<string, unknown>) {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          return Promise.resolve(handlers[name] ?? null);
        },
      },
    },
  });
}

async function runPostLoader(handlers: Record<string, unknown>) {
  const queryClient = makeLoaderQueryClient(handlers);
  const loader = routeModule.Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<Record<string, unknown>>;
  return await loader({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
    },
    params: { publicId: "baby-smith" },
  });
}

function renderResource(ui: ReactElement) {
  const view = render(<LocaleProvider locale="en-GB">{ui}</LocaleProvider>);
  return makeResource(view, () => {
    view.unmount();
  });
}

const managerBabyDoc = {
  _id: "baby-id" as Id<"baby">,
  _creationTime: 1,
  name: "Baby Smith",
  dueDate: "2026-09-01",
  dueDateDisplayMode: "exact" as const,
  publicDueDateText: null,
  theme: null,
  locale: null,
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
  milestoneVisibility: DEFAULT_MILESTONE_VISIBILITY,
  photoId: null,
  birthJourney: "labor" as const,
  publicId: "baby-smith",
};

test("post loader fetches manager access data", async () => {
  const result = await runPostLoader({
    "baby:getManagerBaby": { _id: "baby-id", name: "Baby Smith" },
    "coParents:myAccess": { canManage: true, isOwner: true, isCoParent: false },
  });

  expect(result.managerBaby).toMatchObject({
    input: { babyId: "baby-smith" },
    initialData: { name: "Baby Smith" },
  });
});

test("post loader redirects non-managers to the public baby page", async () => {
  await expect(
    runPostLoader({
      "baby:getManagerBaby": "forbidden",
      "coParents:myAccess": { canManage: false, isOwner: false, isCoParent: false },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      resetScroll: false,
    },
  });
});

test("post overlay closes to the baby page after dismiss", async () => {
  mocks.navigate.mockReset();
  mocks.historyBack.mockReset();
  mocks.canGoBack.mockReturnValue(false);
  mocks.historyState.routeModal = undefined;
  mocks.loaderData = {
    managerBaby: testPreloadedConvexQuery<typeof api.baby.getManagerBaby>({
      input: { babyId: "baby-smith" },
      initialData: managerBabyDoc,
    }),
    myAccess: testPreloadedConvexQuery<typeof api.coParents.myAccess>({
      input: { babyId: "baby-smith" },
      initialData: { canManage: true, isOwner: true, isCoParent: false },
    }),
  };

  await using view = renderResource(<BabyPostUpdateOverlay />);

  fireEvent.click(view.getByRole("button", { name: "dismiss" }));

  expect(mocks.historyBack).not.toHaveBeenCalled();
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});

test("post overlay prefers history.back when opened via push", async () => {
  mocks.navigate.mockReset();
  mocks.historyBack.mockReset();
  mocks.canGoBack.mockReturnValue(true);
  mocks.historyState.routeModal = true;
  mocks.loaderData = {
    managerBaby: testPreloadedConvexQuery<typeof api.baby.getManagerBaby>({
      input: { babyId: "baby-smith" },
      initialData: managerBabyDoc,
    }),
    myAccess: testPreloadedConvexQuery<typeof api.coParents.myAccess>({
      input: { babyId: "baby-smith" },
      initialData: { canManage: true, isOwner: true, isCoParent: false },
    }),
  };

  await using view = renderResource(<BabyPostUpdateOverlay />);

  fireEvent.click(view.getByRole("button", { name: "dismiss" }));

  expect(mocks.historyBack).toHaveBeenCalledOnce();
  expect(mocks.navigate).not.toHaveBeenCalled();
});

test("successful post completes onboarding and closes the overlay", async () => {
  mocks.navigate.mockReset();
  mocks.historyBack.mockReset();
  mocks.canGoBack.mockReturnValue(false);
  mocks.historyState.routeModal = undefined;
  mocks.completeStep.mockClear();
  mocks.loaderData = {
    managerBaby: testPreloadedConvexQuery<typeof api.baby.getManagerBaby>({
      input: { babyId: "baby-smith" },
      initialData: managerBabyDoc,
    }),
    myAccess: testPreloadedConvexQuery<typeof api.coParents.myAccess>({
      input: { babyId: "baby-smith" },
      initialData: { canManage: true, isOwner: true, isCoParent: false },
    }),
  };

  await using view = renderResource(<BabyPostUpdateOverlay />);

  fireEvent.click(view.getByRole("button", { name: "post for Baby Smith" }));

  expect(mocks.completeStep).toHaveBeenCalledWith({ stepId: "post_update" });
  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});
