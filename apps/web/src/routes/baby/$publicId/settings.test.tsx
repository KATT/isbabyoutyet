import { fireEvent } from "@testing-library/react";
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
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { renderWithOverlayRouter } from "@/test/renderWithOverlayRouter";
import {
  BabySettingsOverlayView,
  managerDocToBabyData,
  Route,
  type BabySettingsOverlayDeps,
} from "@/routes/baby/$publicId/settings";

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
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });
  const loader = Route.options.loader as unknown as (opts: {
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
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });
  const beforeLoad = Route.options.beforeLoad as unknown as (opts: {
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

const managerBabyDoc = {
  _id: "baby-id" as Id<"baby">,
  _creationTime: 1,
  name: "Baby Smith",
  dueDate: "2026-09-01",
  dueDateDisplayMode: "exact" as const,
  publicDueDateText: null,
  theme: null,
  locale: null,
  resolvedLocale: "en-GB" as const,
  timeZone: "Europe/London",
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
  milestoneVisibility: DEFAULT_MILESTONE_VISIBILITY,
  photoId: null,
  birthJourney: "labor" as const,
  publicId: "baby-smith",
};

const coParentsList = testPreloadedConvexQuery<typeof api.coParents.listForBaby>({
  input: { babyId: "baby-smith" },
  initialData: { coParents: [], invites: [] },
});

function stubSettingsPanel(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenChangeComplete: ((open: boolean) => void) | null;
  onUpdate: BabyUpdateHandler;
  onMilestoneRedate: MilestoneRedateHandler;
  onMilestoneRemove: MilestoneRemoveHandler;
  onDelete: (() => void | Promise<void>) | null;
}): ReactNode {
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
}

function makeDeps(overrides: Partial<BabySettingsOverlayDeps> = {}): BabySettingsOverlayDeps {
  return {
    updateBaby: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
    removeBaby: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
    redateMilestone: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
    unmarkMilestone: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
    invalidate: vi.fn<() => Promise<void>>().mockResolvedValue(undefined),
    navigateToDashboard: vi.fn<() => void>(),
    ...overrides,
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
  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabySettingsOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        isOwner={true}
        profileLocale="en-GB"
        coParentsList={coParentsList}
        deps={makeDeps()}
        renderSettingsPanel={stubSettingsPanel}
      />
    ),
  });

  fireEvent.click(ctx.view.getByRole("button", { name: "close settings" }));

  expect(ctx.back).not.toHaveBeenCalled();
  expect(ctx.navigate).toHaveBeenCalledWith({
    to: "/baby/$publicId",
    params: { publicId: "baby-smith" },
    replace: true,
    resetScroll: false,
  });
});

test("settings overlay prefers history.back when opened via push", async () => {
  await using ctx = await renderWithOverlayRouter({
    overlayPush: true,
    wrap: null,
    ui: (
      <BabySettingsOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        isOwner={true}
        profileLocale="en-GB"
        coParentsList={coParentsList}
        deps={makeDeps()}
        renderSettingsPanel={stubSettingsPanel}
      />
    ),
  });

  fireEvent.click(ctx.view.getByRole("button", { name: "close settings" }));

  expect(ctx.back).toHaveBeenCalledOnce();
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("settings overlay routes panel edits through mutations and invalidation", async () => {
  const deps = makeDeps();

  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabySettingsOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        isOwner={true}
        profileLocale="en-GB"
        coParentsList={coParentsList}
        deps={deps}
        renderSettingsPanel={stubSettingsPanel}
      />
    ),
  });

  fireEvent.click(ctx.view.getByRole("button", { name: "update settings" }));
  fireEvent.click(ctx.view.getByRole("button", { name: "redate milestone" }));
  fireEvent.click(ctx.view.getByRole("button", { name: "remove milestone" }));
  fireEvent.click(ctx.view.getByRole("button", { name: "delete page" }));

  await vi.waitFor(() => {
    expect(deps.updateBaby).toHaveBeenCalledWith({
      babyId: "baby-id",
      name: "Nova Rae",
    });
  });
  expect(deps.redateMilestone).toHaveBeenCalledWith({
    babyId: "baby-id",
    milestone: "gone_to_hospital",
    occurredAt: Date.parse("2026-08-10T12:00:00.000Z"),
  });
  expect(deps.unmarkMilestone).toHaveBeenCalledWith({
    babyId: "baby-id",
    milestone: "labor_started",
  });
  expect(deps.removeBaby).toHaveBeenCalledWith({ babyId: "baby-id" });
  expect(deps.navigateToDashboard).toHaveBeenCalled();
  expect(deps.invalidate).toHaveBeenCalled();
});

test("settings overlay hides delete for co-parents", async () => {
  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabySettingsOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        isOwner={false}
        profileLocale="en-GB"
        coParentsList={coParentsList}
        deps={makeDeps()}
        renderSettingsPanel={stubSettingsPanel}
      />
    ),
  });

  expect(ctx.view.queryByRole("button", { name: "delete page" })).toBeNull();
});

test("BabySettingsOverlay mounts from the real route loader", async () => {
  await using ctx = await renderMountedFileRoute({
    route: Route,
    path: "/baby/$publicId/settings",
    initialEntry: "/baby/baby-smith/settings",
    wrap: null,
    handlers: {
      "baby:getByPublicId": managerBabyDoc,
      "baby:getManagerBaby": managerBabyDoc,
      "coParents:myAccess": { canManage: true, isOwner: true, isCoParent: false },
      "coParents:listForBaby": { coParents: [], invites: [] },
      "profile:get": { locale: "en-GB", timeZone: "Europe/London", isAdmin: false },
    },
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("heading", { name: "Settings" })).toBeTruthy();
});
