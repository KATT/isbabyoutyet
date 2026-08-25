import { convexQuery } from "@convex-dev/react-query";
import { fireEvent } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import { expect, test, vi } from "vitest";
import { getBabySeo } from "@/lib/baby-seo";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby } from "@/test/convexTestSeed";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { renderWithOverlayRouter } from "@/test/renderWithOverlayRouter";
import { BabyShareOverlayView, Route } from "@/routes/baby/$publicId/share";

function babyDoc(opts: {
  publicId: string;
  theme: "baby-blue" | "orange";
}): NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>> {
  return {
    _id: "jd7baby000000000000000000" as Id<"baby">,
    _creationTime: 1,
    publicId: opts.publicId,
    name: "Baby Smith",
    photoUrl: null,
    thumbnailUrl: null,
    blurDataUrl: null,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact" as const,
    theme: opts.theme,
    locale: "en-GB",
    resolvedLocale: "en-GB",
    timeZone: "Europe/London",
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    milestoneVisibility: { showLabor: true, showHospital: true },
  };
}

async function withShareRouteHandlers<TResult>(
  handlers: Record<string, unknown>,
  run: (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<TResult>,
) {
  const queryClient = new QueryClient({
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
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });

  return await run({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
    },
    params: { publicId: "baby-smith" },
  });
}

test("beforeLoad validates and canonicalizes the baby slug", async () => {
  const beforeLoad = Route.options.beforeLoad as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<unknown>;

  await expect(
    withShareRouteHandlers({ "baby:getByPublicId": null }, beforeLoad),
  ).rejects.toMatchObject({ isNotFound: true });
  await expect(
    withShareRouteHandlers(
      { "baby:getByPublicId": babyDoc({ publicId: "baby-nova", theme: "baby-blue" }) },
      beforeLoad,
    ),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId/share",
      params: { publicId: "baby-nova" },
      replace: true,
    },
  });
});

test("loader prefetches the canonical OG image in the browser", async () => {
  const OriginalImage = globalThis.Image;
  class MockImage {
    #load: (() => void) | null = null;
    addEventListener(type: string, listener: () => void) {
      if (type === "load") this.#load = listener;
    }
    set src(_value: string) {
      queueMicrotask(() => {
        this.#load?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);
  await using _image = makeResource({}, () => {
    vi.stubGlobal("Image", OriginalImage);
  });
  const loader = Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<{
    imagePrefetch: { input: string | undefined };
    myAccess: { initialData: { canManage: boolean } };
    shareLink: string;
  }>;

  const baby = babyDoc({ publicId: "baby-smith", theme: "baby-blue" });
  const data = await withShareRouteHandlers(
    {
      "baby:getByPublicId": baby,
      "coParents:myAccess": { canManage: false, isOwner: false },
    },
    loader,
  );

  const prefetchedImageUrl = new URL(data.imagePrefetch.input ?? "");
  expect(prefetchedImageUrl.pathname).toBe("/og/baby/baby-smith");
  expect(prefetchedImageUrl.searchParams.get("v")).toBeTruthy();
  expect(data.imagePrefetch.input).toBe(getBabySeo(baby, "baby-smith").imageUrl);
  expect(data.myAccess.initialData.canManage).toBe(false);
  expect(data.shareLink).toBe("https://isbabyoutyet.com/baby/baby-smith");
});

test("loader replaces a cached old theme with the fresh baby snapshot", async () => {
  const oldBaby = babyDoc({ publicId: "baby-smith", theme: "orange" });
  const freshBaby = babyDoc({ publicId: "baby-smith", theme: "baby-blue" });
  const queryFn = vi.fn<(ctx: { queryKey: readonly unknown[] }) => Promise<unknown>>((ctx) => {
    const name = String(ctx.queryKey[1]);
    if (name === "baby:getByPublicId") {
      return Promise.resolve(freshBaby);
    }
    return Promise.resolve({ canManage: false, isOwner: false });
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn } },
  });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });
  queryClient.setQueryData(
    convexQuery(api.baby.getByPublicId, { id: "baby-smith" }).queryKey,
    oldBaby,
  );
  const loader = Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<{
    imagePrefetch: { input: string | undefined };
  }>;

  const data = await loader({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
    },
    params: { publicId: "baby-smith" },
  });

  expect(data.imagePrefetch.input).toBe(getBabySeo(freshBaby, "baby-smith").imageUrl);
  expect(queryFn).toHaveBeenCalledWith(
    expect.objectContaining({
      queryKey: convexQuery(api.baby.getByPublicId, { id: "baby-smith" }).queryKey,
    }),
  );
});

test("copies from the route overlay and dismisses through overlay history", async () => {
  const baby = babyDoc({ publicId: "baby-smith", theme: "baby-blue" });
  const preview = getBabySeo(baby, "baby-smith");
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  await using _clipboard = makeResource({}, () => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const completeOnboardingStep = vi
    .fn<(args: { stepId: "share_link" }) => Promise<void>>()
    .mockResolvedValue(undefined);

  await using ctx = await renderWithOverlayRouter({
    overlayPush: true,
    wrap: null,
    ui: (
      <BabyShareOverlayView
        publicId="baby-smith"
        shareLink="https://isbabyoutyet.com/baby/baby-smith"
        sharePreview={preview}
        canManage={true}
        completeOnboardingStep={completeOnboardingStep}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  const image = ctx.view.getByRole("img", { name: preview.title });
  expect(image.getAttribute("src")).toBe(preview.imageUrl);
  fireEvent.click(ctx.view.getByRole("button", { name: "Copy link to share" }));
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("https://isbabyoutyet.com/baby/baby-smith");
    expect(ctx.view.getByRole("button", { name: "Copied!" })).toBeTruthy();
    expect(completeOnboardingStep).toHaveBeenCalledWith({ stepId: "share_link" });
  });

  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));
  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalledOnce();
  });
});

test("BabyShareOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.baby.update, {
    babyId: baby.babyId,
    theme: "baby-blue",
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/share",
    initialEntry: `/baby/${baby.publicId}/share`,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("heading", { name: "Share the Link" })).toBeTruthy();
});

test("share overlay falls back to execCommand when clipboard.writeText fails", async () => {
  const preview = getBabySeo(babyDoc({ publicId: "baby-smith", theme: "baby-blue" }), "baby-smith");
  const writeText = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("denied"));
  const execCommand = vi.fn<() => boolean>().mockReturnValue(true);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  await using _clipboard = makeResource({}, () => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const hadExecCommand = "execCommand" in document;
  const originalExecCommand = document.execCommand;
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: execCommand,
  });
  await using _exec = makeResource({}, () => {
    if (hadExecCommand) {
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        writable: true,
        value: originalExecCommand,
      });
      return;
    }
    Reflect.deleteProperty(document, "execCommand");
  });

  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabyShareOverlayView
        publicId="baby-smith"
        shareLink="https://isbabyoutyet.com/baby/baby-smith"
        sharePreview={preview}
        canManage={false}
        completeOnboardingStep={() => undefined}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Copy link to share" }));
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(ctx.view.getByRole("button", { name: "Copied!" })).toBeTruthy();
  });
});
