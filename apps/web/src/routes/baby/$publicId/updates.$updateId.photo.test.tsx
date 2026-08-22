import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { testInitiatedQuery } from "@workspace/query-prefetch/test-helpers";
import { browserImageFactory } from "@/lib/image-prefetch";

const updateId = "jd7update00000000000000001" as Id<"updates">;

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(options: unknown) => void>(),
  historyBack: vi.fn<() => void>(),
  canGoBack: vi.fn<() => boolean>().mockReturnValue(false),
  historyState: { overlay: undefined as true | undefined },
  params: { publicId: "baby-smith", updateId: "jd7update00000000000000001" },
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
      fullPath: "/baby/$publicId/updates/$updateId/photo",
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
  };
});

const routeModule = await import("@/routes/baby/$publicId/updates.$updateId.photo");
const { BabyUpdatePhotoOverlay } = routeModule;

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
  try {
    return await run({
      context: {
        queryClient,
        convexPreloader: getConvexQueryPreloader(queryClient),
      },
      params: { publicId: "baby-smith", updateId },
    });
  } finally {
    queryClient.clear();
  }
}

async function runUpdatePhotoBeforeLoad(handlers: Record<string, unknown>) {
  const beforeLoad = routeModule.Route.options.beforeLoad as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string; updateId: string };
  }) => Promise<unknown>;
  return await withUpdatePhotoRouteHandlers(handlers, beforeLoad);
}

async function runUpdatePhotoLoader(handlers: Record<string, unknown>) {
  const loader = routeModule.Route.options.loader as unknown as (opts: {
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
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);
  await using _image = makeResource({}, () => {
    vi.stubGlobal("Image", OriginalImage);
  });

  const loader = routeModule.Route.options.loader as unknown as (opts: {
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

test("update photo overlay 404s when loader data loses the photo", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mocks.loaderData = {
    updatePhoto: testPreloadedConvexQuery<typeof api.timeline.getUpdatePhoto>({
      input: { babyId: "baby-smith", updateId },
      initialData: null,
    }),
    imagePrefetch: testInitiatedQuery(browserImageFactory, "https://cdn.example/update.jpg"),
  };

  expect(() =>
    render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider locale="en-GB">
          <BabyUpdatePhotoOverlay />
        </LocaleProvider>
      </QueryClientProvider>,
    ),
  ).toThrow(
    expect.objectContaining({
      isNotFound: true,
    }),
  );
  queryClient.clear();
});

test("dismisses the update photo overlay after the dialog closes", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const photoUrl = "https://cdn.example/update.jpg";
  mocks.loaderData = {
    updatePhoto: testPreloadedConvexQuery<typeof api.timeline.getUpdatePhoto>({
      input: { babyId: "baby-smith", updateId },
      initialData: {
        photoUrl,
        blurDataUrl: null,
        babyName: "Baby Smith",
      },
    }),
    imagePrefetch: testInitiatedQuery(browserImageFactory, photoUrl),
  };
  mocks.historyState.overlay = true;
  mocks.canGoBack.mockReturnValue(true);
  mocks.historyBack.mockClear();
  mocks.navigate.mockClear();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale="en-GB">
        <BabyUpdatePhotoOverlay />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
    queryClient.clear();
  });

  expect(view.getByAltText("Photo of Baby Smith")).toBeTruthy();
  await vi.waitFor(() => {
    expect(view.getByTestId("dialog").getAttribute("data-open")).toBe("true");
  });
  fireEvent.click(view.getByRole("button", { name: "dismiss" }));
  await vi.waitFor(() => {
    expect(mocks.historyBack).toHaveBeenCalled();
  });
});
