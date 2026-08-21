import { convexQuery } from "@convex-dev/react-query";
import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
import { getBabySeo } from "@/lib/baby-seo";
import { browserImageFactory } from "@/lib/image-prefetch";
import { LocaleProvider } from "@/lib/i18n";
import { testInitiatedQuery } from "@workspace/query-prefetch/test-helpers";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn<(options: unknown) => void>(),
  historyBack: vi.fn<() => void>(),
  canGoBack: vi.fn<() => boolean>().mockReturnValue(false),
  historyState: { overlay: undefined as true | undefined },
  completeOnboardingStep: vi.fn<(args: unknown) => Promise<void>>().mockResolvedValue(undefined),
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
      fullPath: "/baby/$publicId/share",
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
  useCompleteOnboardingStep: () => mocks.completeOnboardingStep,
}));

vi.mock("@workspace/ui/components/dialog", async () => {
  const React = await import("react");
  function MockDialog(props: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onOpenChangeComplete: (open: boolean) => void;
    children: ReactNode;
  }) {
    const wasOpen = React.useRef(props.open);
    React.useEffect(() => {
      if (wasOpen.current && !props.open) {
        props.onOpenChangeComplete(false);
      }
      wasOpen.current = props.open;
    }, [props.open, props.onOpenChangeComplete]);
    return (
      <div role="dialog" data-open={props.open}>
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
    DialogDescription: (props: { children: ReactNode }) => <p>{props.children}</p>,
    DialogHeader: (props: { children: ReactNode }) => <div>{props.children}</div>,
    DialogTitle: (props: { children: ReactNode }) => <h2>{props.children}</h2>,
  };
});

const routeModule = await import("@/routes/baby/$publicId/share");
const { BabyShareOverlay } = routeModule;

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
  const beforeLoad = routeModule.Route.options.beforeLoad as unknown as (opts: {
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
  }) => Promise<{
    imagePrefetch: { input: string | undefined };
    canManage: boolean;
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
  expect(data.canManage).toBe(false);
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
  const loader = routeModule.Route.options.loader as unknown as (opts: {
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
  const oldBaby = babyDoc({ publicId: "baby-smith", theme: "orange" });
  const freshBaby = babyDoc({ publicId: "baby-smith", theme: "baby-blue" });
  const oldImageUrl = getBabySeo(oldBaby, "baby-smith").imageUrl;
  const freshPreview = getBabySeo(freshBaby, "baby-smith");
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });
  queryClient.setQueryData(
    convexQuery(api.baby.getByPublicId, { id: "baby-smith" }).queryKey,
    freshBaby,
  );
  queryClient.setQueryData(browserImageFactory(freshPreview.imageUrl).queryKey, {
    url: freshPreview.imageUrl,
    ok: true,
  });
  mocks.loaderData = {
    baby: testPreloadedConvexQuery<typeof api.baby.getByPublicId>({
      input: { id: "baby-smith" },
      initialData: oldBaby,
    }),
    imagePrefetch: testInitiatedQuery(browserImageFactory, oldImageUrl),
    canManage: true,
    shareLink: "https://isbabyoutyet.com/baby/baby-smith",
  };
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
  mocks.historyState.overlay = true;
  mocks.canGoBack.mockReturnValue(true);
  mocks.historyBack.mockClear();
  mocks.completeOnboardingStep.mockClear();

  const view = render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale="en-GB">
        <BabyShareOverlay />
      </LocaleProvider>
    </QueryClientProvider>,
  );
  await using _view = makeResource(view, () => {
    view.unmount();
  });

  const image = view.getByRole("img", { name: freshPreview.title });
  expect(image.getAttribute("src")).toBe(freshPreview.imageUrl);
  fireEvent.click(view.getByRole("button", { name: "Copy link to share" }));
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledWith("https://isbabyoutyet.com/baby/baby-smith");
    expect(view.getByRole("button", { name: "Copied!" })).toBeTruthy();
    expect(mocks.completeOnboardingStep).toHaveBeenCalledWith({ stepId: "share_link" });
  });

  fireEvent.click(view.getByRole("button", { name: "dismiss" }));
  await vi.waitFor(() => {
    expect(mocks.historyBack).toHaveBeenCalledOnce();
  });
});
