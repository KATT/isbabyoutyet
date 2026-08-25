import { fireEvent } from "@testing-library/react";
import { QueryClient } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { expect, test, vi } from "vitest";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { renderWithOverlayRouter } from "@/test/renderWithOverlayRouter";
import { BabyPhotoOverlayView, Route } from "@/routes/baby/$publicId/photo";

async function withPhotoRouteHandlers<TResult>(
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

async function runPhotoBeforeLoad(handlers: Record<string, unknown>) {
  const beforeLoad = Route.options.beforeLoad as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<unknown>;
  return await withPhotoRouteHandlers(handlers, beforeLoad);
}

async function runPhotoLoader(handlers: Record<string, unknown>) {
  const loader = Route.options.loader as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<{
    baby: unknown;
    imagePrefetch: { input: string | undefined };
  }>;
  return await withPhotoRouteHandlers(handlers, loader);
}

function babyDoc(opts: { photoUrl: string | null }) {
  return {
    _id: "jd7baby000000000000000000",
    publicId: "baby-smith",
    name: "Baby Smith",
    photoUrl: opts.photoUrl,
    thumbnailUrl: null,
    blurDataUrl: null,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact" as const,
    laborStarted: null,
    wentToHospital: null,
    babyBorn: null,
    milestoneVisibility: { showLabor: true, showHospital: true },
    resolvedLocale: "en-GB",
  };
}

test("beforeLoad 404s unknown babies", async () => {
  await expect(runPhotoBeforeLoad({ "baby:getByPublicId": null })).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("beforeLoad redirects when the public id resolves to a different slug", async () => {
  await expect(
    runPhotoBeforeLoad({
      "baby:getByPublicId": {
        ...babyDoc({ photoUrl: "https://cdn.example/full.jpg" }),
        publicId: "baby-nova",
      },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId/photo",
      params: { publicId: "baby-nova" },
      replace: true,
    },
  });
});

test("beforeLoad allows matching public ids", async () => {
  await expect(
    runPhotoBeforeLoad({
      "baby:getByPublicId": babyDoc({ photoUrl: "https://cdn.example/full.jpg" }),
    }),
  ).resolves.toBeUndefined();
});

test("loader redirects home when the baby has no page photo", async () => {
  await expect(
    runPhotoLoader({
      "baby:getByPublicId": babyDoc({ photoUrl: null }),
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      resetScroll: false,
    },
  });
});

test("loader prefetches the full image in the browser", async () => {
  const photoUrl = "https://cdn.example/full.jpg";
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          return Promise.resolve(name === "baby:getByPublicId" ? babyDoc({ photoUrl }) : null);
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
    params: { publicId: string };
  }) => Promise<{ imagePrefetch: { input: string | undefined } }>;

  const data = await loader({
    context: {
      queryClient,
      convexPreloader: getConvexQueryPreloader(queryClient),
    },
    params: { publicId: "baby-smith" },
  });

  expect(data.imagePrefetch).toMatchObject({ input: photoUrl });
  await vi.waitFor(() => {
    expect(queryClient.getQueryData(["browserImagePrefetch", photoUrl])).toEqual({
      url: photoUrl,
      ok: true,
    });
  });
});

test("dismisses the lightbox overlay after the dialog closes", async () => {
  const photoUrl = "https://cdn.example/full.jpg";

  await using ctx = await renderWithOverlayRouter({
    overlayPush: true,
    wrap: null,
    ui: (
      <BabyPhotoOverlayView
        publicId="baby-smith"
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

test("BabyPhotoOverlay mounts from the real route loader", async () => {
  await using _image = stubBrowserImageResource();
  const photoUrl = "https://cdn.example/full.jpg";

  await using ctx = await renderMountedFileRoute({
    route: Route,
    path: "/baby/$publicId/photo",
    initialEntry: "/baby/baby-smith/photo",
    wrap: null,
    handlers: {
      "baby:getByPublicId": babyDoc({ photoUrl }),
    },
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
});
