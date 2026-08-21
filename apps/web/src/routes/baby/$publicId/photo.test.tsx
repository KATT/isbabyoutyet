import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { LocaleProvider } from "@/lib/i18n";
import { testInitiatedQuery } from "@workspace/query-prefetch/test-helpers";
import { browserImageFactory } from "@/lib/image-prefetch";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(options: unknown) => void>(),
  historyBack: vi.fn<() => void>(),
  canGoBack: vi.fn<() => boolean>().mockReturnValue(false),
  historyState: { overlay: undefined as true | undefined },
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
      fullPath: "/baby/$publicId/photo",
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

const routeModule = await import("@/routes/baby/$publicId/photo");
const { BabyPhotoOverlay } = routeModule;

test("current-photo overlay opts into tagged public caching", () => {
  const headers = (
    routeModule.Route.options.headers as (opts: {
      params: { publicId: string };
    }) => Record<string, string>
  )({ params: { publicId: "juniper-hale" } });

  expect(headers["Cache-Control"]).toContain("public");
  expect(headers["Vercel-Cache-Tag"]).toContain("baby-public-id:juniper-hale");
});

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
  try {
    return await run({
      context: {
        queryClient,
        convexPreloader: getConvexQueryPreloader(queryClient),
      },
      params: { publicId: "baby-smith" },
    });
  } finally {
    queryClient.clear();
  }
}

async function runPhotoBeforeLoad(handlers: Record<string, unknown>) {
  const beforeLoad = routeModule.Route.options.beforeLoad as unknown as (opts: {
    context: {
      queryClient: QueryClient;
      convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
    };
    params: { publicId: string };
  }) => Promise<unknown>;
  return await withPhotoRouteHandlers(handlers, beforeLoad);
}

async function runPhotoLoader(handlers: Record<string, unknown>) {
  const loader = routeModule.Route.options.loader as unknown as (opts: {
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

test("overlay 404s when loader data loses the page photo", async () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  mocks.loaderData = {
    baby: testPreloadedConvexQuery<typeof api.baby.getByPublicId>({
      input: { id: "baby-smith" },
      initialData: babyDoc({ photoUrl: null }) as never,
    }),
    imagePrefetch: testInitiatedQuery(browserImageFactory, "https://cdn.example/full.jpg"),
  };

  expect(() =>
    render(
      <QueryClientProvider client={queryClient}>
        <LocaleProvider locale="en-GB">
          <BabyPhotoOverlay />
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
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const photoUrl = "https://cdn.example/full.jpg";
  mocks.loaderData = {
    baby: testPreloadedConvexQuery<typeof api.baby.getByPublicId>({
      input: { id: "baby-smith" },
      initialData: babyDoc({ photoUrl }) as never,
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
        <BabyPhotoOverlay />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
    queryClient.clear();
  });

  expect(view.getByAltText("Photo of Baby Smith")).toBeTruthy();
  fireEvent.click(view.getByRole("button", { name: "dismiss" }));
  await vi.waitFor(() => {
    expect(mocks.historyBack).toHaveBeenCalled();
  });
});
