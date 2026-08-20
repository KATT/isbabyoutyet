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
import type { BrowserImageFactory } from "@/lib/image-prefetch";

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

function makeLoaderQueryClient(handlers: Record<string, unknown>) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          if (name in handlers) {
            return Promise.resolve(handlers[name]);
          }
          return Promise.reject(new Error(`unexpected query ${name}`));
        },
      },
    },
  });
  return makeResource(queryClient, () => {
    queryClient.clear();
  });
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

test("loader redirects home when the baby has no page photo", async () => {
  await using queryClient = makeLoaderQueryClient({
    "baby:getByPublicId": babyDoc({ photoUrl: null }),
  });
  const preloader = getConvexQueryPreloader(queryClient);

  await expect(
    routeModule.Route.options.loader!({
      context: { convexPreloader: preloader, queryClient },
      params: { publicId: "baby-smith" },
    } as never),
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
  await using queryClient = makeLoaderQueryClient({
    "baby:getByPublicId": babyDoc({ photoUrl }),
  });
  const preloader = getConvexQueryPreloader(queryClient);

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

  const data = await routeModule.Route.options.loader!({
    context: { convexPreloader: preloader, queryClient },
    params: { publicId: "baby-smith" },
  } as never);

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
    imagePrefetch: testInitiatedQuery(
      ((url: string) => ({ queryKey: ["browserImagePrefetch", url] })) as BrowserImageFactory,
      photoUrl,
    ),
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
