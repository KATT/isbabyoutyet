import { fireEvent, render } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { DEFAULT_MILESTONE_VISIBILITY } from "@workspace/convex/src/types";
import type {
  BabyUpdateHandler,
  MilestoneRedateHandler,
  MilestoneRemoveHandler,
} from "@workspace/convex/src/types";
import type { ReactElement, ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(options: unknown) => void>(),
  invalidate: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
  updateBaby: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
  removeBaby: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
  redateMilestone: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
  unmarkMilestone: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
  params: { publicId: "baby-smith" },
  loaderData: null as null | Record<string, unknown>,
  settingsPanel: null as null | {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: ((open: boolean) => void) | null;
    onUpdate: BabyUpdateHandler;
    onMilestoneRedate: MilestoneRedateHandler;
    onMilestoneRemove: MilestoneRemoveHandler;
    onDelete: (() => void | Promise<void>) | null;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    options,
    ...options,
    fullPath: "/baby/$publicId/settings",
    useParams: () => mocks.params,
    useLoaderData: () => mocks.loaderData,
  }),
  useNavigate: () => mocks.navigate,
  useRouter: () => ({ invalidate: mocks.invalidate }),
  notFound: () => {
    throw { isNotFound: true };
  },
  redirect: (opts: unknown) => {
    throw { options: opts };
  },
}));

vi.mock("convex/react", () => ({
  useMutation: (() => {
    let call = 0;
    return () => {
      const index = call;
      call += 1;
      if (index % 4 === 0) return mocks.updateBaby;
      if (index % 4 === 1) return mocks.removeBaby;
      if (index % 4 === 2) return mocks.redateMilestone;
      return mocks.unmarkMilestone;
    };
  })(),
}));

vi.mock("@/components/baby/settings-panel", () => ({
  SettingsPanel: (props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: ((open: boolean) => void) | null;
    onUpdate: BabyUpdateHandler;
    onMilestoneRedate: MilestoneRedateHandler;
    onMilestoneRemove: MilestoneRemoveHandler;
    onDelete: (() => void | Promise<void>) | null;
    children: ReactNode | undefined;
  }) => {
    mocks.settingsPanel = props;
    return (
      <>
        <button type="button" onClick={() => props.onUpdate({ name: "Nova Rae" })}>
          update settings
        </button>
        <button
          type="button"
          onClick={() => props.onMilestoneRedate("gone_to_hospital", "2026-08-10T12:00:00.000Z")}
        >
          redate milestone
        </button>
        <button type="button" onClick={() => props.onMilestoneRemove("labor_started")}>
          remove milestone
        </button>
        <button
          type="button"
          onClick={() => {
            props.onOpenChange(false);
            props.onOpenChangeComplete?.(false);
          }}
        >
          close settings
        </button>
        {props.onDelete ? (
          <button type="button" onClick={() => void props.onDelete?.()}>
            delete page
          </button>
        ) : null}
      </>
    );
  },
}));

const routeModule = await import("@/routes/baby/$publicId/settings");
const { BabySettingsOverlay, managerDocToBabyData } = routeModule;

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

async function runSettingsLoader(handlers: Record<string, unknown>) {
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

async function runSettingsBeforeLoad(handlers: Record<string, unknown>) {
  const queryClient = makeLoaderQueryClient(handlers);
  const beforeLoad = routeModule.Route.options.beforeLoad as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<unknown>;
  return await beforeLoad({
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

function ownerLoaderData() {
  return {
    managerBaby: testPreloadedConvexQuery<typeof api.baby.getManagerBaby>({
      input: { babyId: "baby-smith" },
      initialData: managerBabyDoc,
    }),
    myAccess: testPreloadedConvexQuery<typeof api.coParents.myAccess>({
      input: { babyId: "baby-smith" },
      initialData: { canManage: true, isOwner: true, isCoParent: false },
    }),
    coParentsList: testPreloadedConvexQuery<typeof api.coParents.listForBaby>({
      input: { babyId: "baby-smith" },
      initialData: { coParents: [], invites: [] },
    }),
    profile: testPreloadedConvexQuery<typeof api.profile.get>({
      input: {},
      initialData: { locale: "en-GB", isAdmin: false },
    }),
  };
}

test("settings loader fetches only manager settings data", async () => {
  const result = await runSettingsLoader({
    "baby:getManagerBaby": { _id: "baby-id", name: "Baby Smith" },
    "coParents:myAccess": { canManage: true, isOwner: true },
    "coParents:listForBaby": { coParents: [], invites: [] },
    "profile:get": { locale: "en-GB" },
  });

  expect(result.managerBaby).toMatchObject({
    input: { babyId: "baby-smith" },
    initialData: { name: "Baby Smith" },
  });
  expect(result.coParentsList).toMatchObject({
    input: { babyId: "baby-smith" },
    initialData: { coParents: [], invites: [] },
  });
  expect(result.profile).toMatchObject({
    initialData: { locale: "en-GB" },
  });
});

test("settings loader redirects non-managers to the public baby page", async () => {
  await expect(
    runSettingsLoader({
      "baby:getManagerBaby": "forbidden",
      "coParents:myAccess": { canManage: false, isOwner: false },
      "coParents:listForBaby": "forbidden",
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      resetScroll: false,
    },
  });
});

test("beforeLoad 404s unknown babies", async () => {
  await expect(runSettingsBeforeLoad({ "baby:getByPublicId": null })).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("beforeLoad redirects when the public id resolves to a different slug", async () => {
  await expect(
    runSettingsBeforeLoad({
      "baby:getByPublicId": { ...managerBabyDoc, publicId: "baby-nova" },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId/settings",
      params: { publicId: "baby-nova" },
      replace: true,
    },
  });
});

test("beforeLoad allows matching public ids", async () => {
  await expect(
    runSettingsBeforeLoad({
      "baby:getByPublicId": managerBabyDoc,
    }),
  ).resolves.toBeUndefined();
});

test("managerDocToBabyData maps manager fields for the settings panel", () => {
  expect(managerDocToBabyData(managerBabyDoc)).toMatchObject({
    name: "Baby Smith",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    theme: null,
    locale: null,
  });
});

test("settings overlay closes to the baby page after the dialog exit animation", async () => {
  mocks.navigate.mockReset();
  mocks.loaderData = ownerLoaderData();

  await using view = renderResource(<BabySettingsOverlay />);

  fireEvent.click(view.getByRole("button", { name: "close settings" }));

  expect(mocks.navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});

test("settings overlay routes panel edits through mutations and invalidation", async () => {
  mocks.navigate.mockReset();
  mocks.updateBaby.mockClear();
  mocks.redateMilestone.mockClear();
  mocks.unmarkMilestone.mockClear();
  mocks.removeBaby.mockClear();
  mocks.invalidate.mockClear();
  mocks.loaderData = ownerLoaderData();

  await using view = renderResource(<BabySettingsOverlay />);

  fireEvent.click(view.getByRole("button", { name: "update settings" }));
  fireEvent.click(view.getByRole("button", { name: "redate milestone" }));
  fireEvent.click(view.getByRole("button", { name: "remove milestone" }));
  fireEvent.click(view.getByRole("button", { name: "delete page" }));

  await vi.waitFor(() => {
    expect(mocks.updateBaby).toHaveBeenCalledWith({
      babyId: "baby-id",
      name: "Nova Rae",
    });
  });
  expect(mocks.redateMilestone).toHaveBeenCalledWith({
    babyId: "baby-id",
    milestone: "gone_to_hospital",
    occurredAt: Date.parse("2026-08-10T12:00:00.000Z"),
  });
  expect(mocks.unmarkMilestone).toHaveBeenCalledWith({
    babyId: "baby-id",
    milestone: "labor_started",
  });
  expect(mocks.removeBaby).toHaveBeenCalledWith({ babyId: "baby-id" });
  expect(mocks.navigate).toHaveBeenCalledWith({ to: "/dashboard" });
  expect(mocks.invalidate).toHaveBeenCalled();
});

test("settings overlay hides delete for co-parents", async () => {
  mocks.loaderData = {
    ...ownerLoaderData(),
    myAccess: testPreloadedConvexQuery<typeof api.coParents.myAccess>({
      input: { babyId: "baby-smith" },
      initialData: { canManage: true, isOwner: false, isCoParent: true },
    }),
  };

  await using view = renderResource(<BabySettingsOverlay />);

  expect(view.queryByRole("button", { name: "delete page" })).toBeNull();
});
