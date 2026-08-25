import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { testPreloadedQuery } from "@workspace/query-prefetch/test-helpers";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import { browserPushQueryOptions, prefetchBrowserPushCapability } from "./notification-subscribe";

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const babyRef = "baby-smith";

type BrowserPushCapability =
  | { kind: "unsupported" }
  | { kind: "needsIosInstall" }
  | { kind: "serviceWorkerTimeout" }
  | { kind: "unsubscribed" }
  | { kind: "subscribed"; subscription: PushSubscription; isSubscribed: boolean };

type BrowserPushStub = {
  userAgent: string;
  standalone: boolean;
  displayModeStandalone: boolean;
  hasPushManager: boolean;
  hasNotification: boolean;
  hasServiceWorker: boolean;
  subscription: PushSubscription | null;
  serviceWorkerReady: Promise<ServiceWorkerRegistration>;
};

vi.mock("@convex-dev/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/react-query")>();
  return {
    ...actual,
    useConvexMutation: () => vi.fn<() => Promise<null>>().mockResolvedValue(null),
  };
});

vi.mock("sonner", () => ({
  toast: {
    promise: vi.fn<(...args: unknown[]) => void>(),
    error: vi.fn<(message: string) => void>(),
  },
}));

const { NotificationSubscribe } = await import("./notification-subscribe");

const babyId = "jd7baby000000000000000000" as Id<"baby">;

function stubBrowserPush(stub: Partial<BrowserPushStub>) {
  const restore: Array<() => void> = [];

  function replaceProperty(target: object, opts: { key: string; descriptor: PropertyDescriptor }) {
    const existing = Object.getOwnPropertyDescriptor(target, opts.key);
    Object.defineProperty(target, opts.key, { configurable: true, ...opts.descriptor });
    restore.push(() => {
      if (existing) {
        Object.defineProperty(target, opts.key, existing);
        return;
      }
      Reflect.deleteProperty(target, opts.key);
    });
  }

  if (stub.userAgent !== undefined) {
    replaceProperty(navigator, { key: "userAgent", descriptor: { get: () => stub.userAgent } });
  }
  replaceProperty(navigator, {
    key: "standalone",
    descriptor: { value: stub.standalone ?? false },
  });

  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query: string) =>
    ({
      matches: query === "(display-mode: standalone)" && Boolean(stub.displayModeStandalone),
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
  restore.push(() => {
    window.matchMedia = originalMatchMedia;
  });

  if (stub.hasPushManager) {
    replaceProperty(window, {
      key: "PushManager",
      descriptor: { value: function PushManager() {} },
    });
  } else if ("PushManager" in window) {
    const existing = Object.getOwnPropertyDescriptor(window, "PushManager");
    Reflect.deleteProperty(window, "PushManager");
    restore.push(() => {
      if (existing) {
        Object.defineProperty(window, "PushManager", existing);
      }
    });
  }

  if (stub.hasNotification) {
    replaceProperty(window, {
      key: "Notification",
      descriptor: { value: function Notification() {} },
    });
  } else if ("Notification" in window) {
    const existing = Object.getOwnPropertyDescriptor(window, "Notification");
    Reflect.deleteProperty(window, "Notification");
    restore.push(() => {
      if (existing) {
        Object.defineProperty(window, "Notification", existing);
      }
    });
  }

  if (stub.hasServiceWorker) {
    const registration = {
      pushManager: {
        getSubscription: () => Promise.resolve(stub.subscription ?? null),
      },
    } as ServiceWorkerRegistration;
    replaceProperty(navigator, {
      key: "serviceWorker",
      descriptor: {
        value: {
          ready: stub.serviceWorkerReady ?? Promise.resolve(registration),
        },
      },
    });
  }

  return makeResource({}, () => {
    for (const fn of restore.toReversed()) {
      fn();
    }
  });
}

function queryClientResource(isSubscribedInConvex = true) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          if (name === "pushSubscriptions:isSubscribed") {
            return Promise.resolve(isSubscribedInConvex);
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

const vapidPublicKey = testPreloadedConvexQuery<typeof api.pushSubscriptions.getPublicKey>({
  input: {},
  initialData: "vapid-public-key",
});

function renderSubscribe(capability: BrowserPushCapability) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const view = render(
    <QueryClientProvider client={queryClient}>
      <LocaleProvider locale="en-GB">
        <TooltipProvider>
          <NotificationSubscribe
            babyId={babyId}
            vapidPublicKey={vapidPublicKey}
            browserPush={testPreloadedQuery(
              (ref) => browserPushQueryOptions(queryClient, ref),
              capability,
              babyRef,
            )}
          />
        </TooltipProvider>
      </LocaleProvider>
    </QueryClientProvider>,
  );
  return makeResource(view, () => {
    view.unmount();
    queryClient.clear();
  });
}

test("reports unsupported when the browser has no push APIs", async () => {
  await using queryClient = queryClientResource();

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "unsupported" });
});

test("asks iOS Safari to install as a PWA before offering push", async () => {
  await using queryClient = queryClientResource();
  await using _env = stubBrowserPush({
    userAgent: IPHONE_SAFARI_UA,
    standalone: false,
    displayModeStandalone: false,
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
  });

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "needsIosInstall" });
});

test("reports unsupported when PushManager is missing", async () => {
  await using queryClient = queryClientResource();
  await using _env = stubBrowserPush({
    hasPushManager: false,
    hasNotification: true,
    hasServiceWorker: true,
  });

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "unsupported" });
});

test("treats a ready browser with no push subscription as unsubscribed", async () => {
  await using queryClient = queryClientResource();
  await using _env = stubBrowserPush({
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    subscription: null,
  });

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "unsubscribed" });
});

test("returns the existing browser push subscription and Convex isSubscribed", async () => {
  await using queryClient = queryClientResource(true);
  const subscription = {
    endpoint: "https://push.example/subscription",
  } as PushSubscription;
  await using _env = stubBrowserPush({
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    subscription,
  });

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "subscribed", subscription, isSubscribed: true });
});

test("lets an installed iOS PWA subscribe instead of showing the install guide", async () => {
  await using queryClient = queryClientResource();
  await using _env = stubBrowserPush({
    userAgent: IPHONE_SAFARI_UA,
    standalone: true,
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    subscription: null,
  });

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "unsubscribed" });
});

test("times out if the service worker is not ready in 5 seconds", async () => {
  vi.useFakeTimers();
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });
  await using queryClient = queryClientResource();
  await using _env = stubBrowserPush({
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    serviceWorkerReady: new Promise<ServiceWorkerRegistration>(() => {}),
  });

  const pending = queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));
  await vi.advanceTimersByTimeAsync(5000);

  expect(await pending).toEqual({ kind: "serviceWorkerTimeout" });
});

test("treats a service worker failure as unsubscribed", async () => {
  await using queryClient = queryClientResource();
  const serviceWorkerReady = Promise.reject(new Error("service worker unavailable"));
  void serviceWorkerReady.catch(() => {});
  await using _env = stubBrowserPush({
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    serviceWorkerReady,
  });

  const capability = await queryClient.fetchQuery(browserPushQueryOptions(queryClient, babyRef));

  expect(capability).toEqual({ kind: "unsubscribed" });
});

test("keeps a stable query key scoped by baby for loader prefetch and useQuery", () => {
  const queryClient = new QueryClient();
  expect(browserPushQueryOptions(queryClient, babyRef).queryKey).toEqual([
    "browserPushCapability",
    babyRef,
  ]);
  expect(browserPushQueryOptions(queryClient, babyRef).queryKey).toEqual(
    browserPushQueryOptions(queryClient, babyRef).queryKey,
  );
});

test("prefetches capability and isSubscribed into the query cache in the browser", async () => {
  await using queryClient = queryClientResource(true);
  await using _env = stubBrowserPush({
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    subscription: { endpoint: "https://push.example/sub" } as PushSubscription,
  });

  const handle = prefetchBrowserPushCapability(queryClient, babyRef);

  expect(handle).toMatchObject({ input: babyRef });
  await vi.waitFor(() => {
    expect(
      queryClient.getQueryData(browserPushQueryOptions(queryClient, babyRef).queryKey),
    ).toEqual({
      kind: "subscribed",
      subscription: { endpoint: "https://push.example/sub" },
      isSubscribed: true,
    });
  });
});

test("does not touch PushManager while prefetching on the server", async () => {
  await using queryClient = queryClientResource();
  const originalWindow = globalThis.window;
  vi.stubGlobal("window", undefined);
  await using _window = makeResource({}, () => {
    vi.unstubAllGlobals();
    globalThis.window = originalWindow;
  });

  const ensureSpy = vi.spyOn(queryClient, "ensureQueryData");
  const handle = prefetchBrowserPushCapability(queryClient, babyRef);

  expect(handle).toMatchObject({ input: babyRef });
  expect(ensureSpy).not.toHaveBeenCalled();
  expect(
    queryClient.getQueryData(browserPushQueryOptions(queryClient, babyRef).queryKey),
  ).toBeUndefined();
});

test("shows iOS Home Screen instructions when the PWA is not installed", async () => {
  await using view = renderSubscribe({ kind: "needsIosInstall" });

  fireEvent.click(view.getByRole("button", { name: "Get Notifications" }));

  expect(screen.getByText("Get Notifications on iOS")).toBeTruthy();
  expect(screen.getByText(/Add to Home Screen/i)).toBeTruthy();
});

test("offers subscribe when push is supported without a subscription", async () => {
  await using view = renderSubscribe({ kind: "unsubscribed" });

  expect(view.getByRole("button", { name: "Get Notifications" })).toBeTruthy();
  expect(view.queryByText("Get Notifications on iOS")).toBeNull();
});

test("offers subscribe when the service worker times out", async () => {
  await using view = renderSubscribe({ kind: "serviceWorkerTimeout" });

  expect(view.getByRole("button", { name: "Get Notifications" })).toBeTruthy();
  expect(view.queryByText("Get Notifications on iOS")).toBeNull();
});

test("offers subscribe when push is unsupported", async () => {
  await using view = renderSubscribe({ kind: "unsupported" });

  expect(view.getByRole("button", { name: "Get Notifications" })).toBeTruthy();
});

test("shows unsubscribe when Convex reports an active subscription", async () => {
  await using view = renderSubscribe({
    kind: "subscribed",
    subscription: { endpoint: "https://push.example/sub" } as PushSubscription,
    isSubscribed: true,
  });

  expect(view.getByRole("button", { name: "Unsubscribe" })).toBeTruthy();
});

test("offers subscribe when the browser is subscribed but Convex is not", async () => {
  await using view = renderSubscribe({
    kind: "subscribed",
    subscription: { endpoint: "https://push.example/sub" } as PushSubscription,
    isSubscribed: false,
  });

  expect(view.getByRole("button", { name: "Get Notifications" })).toBeTruthy();
});
