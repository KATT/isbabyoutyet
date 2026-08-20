import { fireEvent, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { ReactNode } from "react";
import { expect, test, vi } from "vitest";
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

function babyDoc(opts: { publicId: string }) {
  return {
    _id: "jd7baby000000000000000000",
    _creationTime: 1,
    publicId: opts.publicId,
    name: "Baby Smith",
    photoUrl: null,
    thumbnailUrl: null,
    blurDataUrl: null,
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact" as const,
    theme: "baby-blue",
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
      { "baby:getByPublicId": babyDoc({ publicId: "baby-nova" }) },
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
    sharePreview: { imageUrl: string; title: string; description: string } | null;
  }>;

  const data = await withShareRouteHandlers(
    {
      "baby:getByPublicId": babyDoc({ publicId: "baby-smith" }),
      "coParents:myAccess": { canManage: false, isOwner: false },
    },
    loader,
  );

  expect(data.sharePreview).not.toBeNull();
  expect(new URL(data.imagePrefetch.input ?? "").pathname).toBe("/og/baby/baby-smith");
  expect(data.sharePreview?.imageUrl).toBe(data.imagePrefetch.input);
  expect(data.canManage).toBe(false);
  expect(data.shareLink).toBe("https://isbabyoutyet.com/baby/baby-smith");
});

test("copies from the route overlay and dismisses through overlay history", async () => {
  const imageUrl = "https://example.com/og/baby/baby-smith";
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  await using _queryClient = makeResource(queryClient, () => {
    queryClient.clear();
  });
  queryClient.setQueryData(browserImageFactory(imageUrl).queryKey, {
    url: imageUrl,
    ok: true,
  });
  mocks.loaderData = {
    imagePrefetch: testInitiatedQuery(browserImageFactory, imageUrl),
    canManage: true,
    shareLink: "https://isbabyoutyet.com/baby/baby-smith",
    sharePreview: {
      imageUrl,
      title: "Is Baby Smith out yet?",
      description: "Track Baby Smith's journey.",
    },
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

  expect(view.getByRole("img", { name: "Is Baby Smith out yet?" })).toBeTruthy();
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
