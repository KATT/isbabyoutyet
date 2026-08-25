import { fireEvent } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { DEFAULT_MILESTONE_VISIBILITY } from "@workspace/convex/src/types";
import { expect, test, vi } from "vitest";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { renderWithOverlayRouter } from "@/test/renderWithOverlayRouter";
import { BabyPostUpdateOverlayView, Route } from "@/routes/baby/$publicId/post";

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
  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabyPostUpdateOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        completeOnboardingStep={() => undefined}
        renderComposer={(opts) => (
          <button type="button" onClick={() => opts.onPosted()}>
            post for {opts.babyName}
          </button>
        )}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("button", { name: "post for Baby Smith" })).toBeTruthy();
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  expect(ctx.back).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      replace: true,
      resetScroll: false,
    });
  });
});

test("post overlay prefers history.back when opened via push", async () => {
  await using ctx = await renderWithOverlayRouter({
    overlayPush: true,
    wrap: null,
    ui: (
      <BabyPostUpdateOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        completeOnboardingStep={() => undefined}
        renderComposer={(opts) => (
          <button type="button" onClick={() => opts.onPosted()}>
            post for {opts.babyName}
          </button>
        )}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalledOnce();
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("successful post completes onboarding and closes the overlay", async () => {
  const completeStep = vi
    .fn<(args: { stepId: "post_update" }) => Promise<void>>()
    .mockResolvedValue(undefined);

  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabyPostUpdateOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        completeOnboardingStep={completeStep}
        renderComposer={(opts) => (
          <button type="button" onClick={() => opts.onPosted()}>
            post for {opts.babyName}
          </button>
        )}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "post for Baby Smith" }));

  expect(completeStep).toHaveBeenCalledWith({ stepId: "post_update" });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      replace: true,
      resetScroll: false,
    });
  });
});

test("BabyPostUpdateOverlay mounts from the real route loader", async () => {
  await using ctx = await renderMountedFileRoute({
    route: Route,
    path: "/baby/$publicId/post",
    initialEntry: "/baby/baby-smith/post",
    wrap: null,
    handlers: {
      "baby:getByPublicId": managerBabyDoc,
      "baby:getManagerBaby": managerBabyDoc,
      "coParents:myAccess": { canManage: true, isOwner: true, isCoParent: false },
    },
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getAllByText("Post an update").length).toBeGreaterThan(0);
});
