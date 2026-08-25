import { fireEvent } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { expect, test, vi } from "vitest";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { renderWithOverlayRouter } from "@/test/renderWithOverlayRouter";
import { BabyUpdatePhotoOverlayView, Route } from "@/routes/baby/$publicId/updates.$updateId.photo";

const updateId = "jd7update00000000000000001" as Id<"updates">;

async function withUpdatePhotoRouteHandlers<TResult>(
  handlers: Record<string, unknown>,
  run: (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string; updateId: string };
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
    params: { publicId: "baby-smith", updateId },
  });
}

async function runUpdatePhotoBeforeLoad(handlers: Record<string, unknown>) {
  const beforeLoad = Route.options.beforeLoad as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string; updateId: string };
  }) => Promise<unknown>;
  return await withUpdatePhotoRouteHandlers(handlers, beforeLoad);
}

async function runUpdatePhotoLoader(handlers: Record<string, unknown>) {
  const loader = Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string; updateId: string };
  }) => Promise<{
    updatePhoto: unknown;
    imagePrefetch: { input: string | undefined };
  }>;
  return await withUpdatePhotoRouteHandlers(handlers, loader);
}

test("update photo beforeLoad 404s unknown babies", async () => {
  await expect(runUpdatePhotoBeforeLoad({ "baby:getByPublicId": null })).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("update photo beforeLoad redirects when the public id resolves to a different slug", async () => {
  await expect(
    runUpdatePhotoBeforeLoad({
      "baby:getByPublicId": {
        _id: "jd7baby000000000000000000",
        publicId: "baby-nova",
        name: "Baby Nova",
        photoUrl: null,
      },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId/updates/$updateId/photo",
      params: { publicId: "baby-nova", updateId },
      replace: true,
    },
  });
});

test("update photo beforeLoad allows matching public ids", async () => {
  await expect(
    runUpdatePhotoBeforeLoad({
      "baby:getByPublicId": {
        _id: "jd7baby000000000000000000",
        publicId: "baby-smith",
        name: "Baby Smith",
        photoUrl: null,
      },
    }),
  ).resolves.toBeUndefined();
});

test("update photo loader redirects home when the update has no photo", async () => {
  await expect(
    runUpdatePhotoLoader({
      "timeline:getUpdatePhoto": null,
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      resetScroll: false,
    },
  });
});

test("update photo loader prefetches the full image in the browser", async () => {
  const photoUrl = "https://cdn.example/update.jpg";
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          return Promise.resolve(
            name === "timeline:getUpdatePhoto"
              ? {
                  photoUrl,
                  blurDataUrl: null,
                  babyName: "Baby Smith",
                }
              : null,
          );
        },
      },
    },
  });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });

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
    params: { publicId: string; updateId: string };
  }) => Promise<{ imagePrefetch: { input: string | undefined } }>;

  const data = await loader({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
    },
    params: { publicId: "baby-smith", updateId },
  });

  expect(data.imagePrefetch).toMatchObject({ input: photoUrl });
  await vi.waitFor(() => {
    expect(queryClient.getQueryData(["browserImagePrefetch", photoUrl])).toEqual({
      url: photoUrl,
      ok: true,
    });
  });
});

test("dismisses the update photo overlay after the dialog closes", async () => {
  const photoUrl = "https://cdn.example/update.jpg";

  await using ctx = await renderWithOverlayRouter({
    overlayPush: true,
    wrap: null,
    ui: (
      <BabyUpdatePhotoOverlayView
        publicId="baby-smith"
        updateId={updateId}
        photoUrl={photoUrl}
        blurDataUrl={null}
        alt="Photo of Baby Smith"
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
  fireEvent.click(ctx.view.getByRole("button", { name: "Close photo" }));
  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalled();
  });
});

test("BabyUpdatePhotoOverlay mounts from the real route loader", async () => {
  await using _image = stubBrowserImageResource();
  const photoUrl = "https://cdn.example/update.jpg";

  await using ctx = await renderMountedFileRoute({
    route: Route,
    path: "/baby/$publicId/updates/$updateId/photo",
    initialEntry: `/baby/baby-smith/updates/${updateId}/photo`,
    wrap: null,
    handlers: {
      "baby:getByPublicId": {
        _id: "jd7baby000000000000000000",
        publicId: "baby-smith",
        name: "Baby Smith",
      },
      "timeline:getUpdatePhoto": {
        photoUrl,
        blurDataUrl: null,
        babyName: "Baby Smith",
      },
    },
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
});
