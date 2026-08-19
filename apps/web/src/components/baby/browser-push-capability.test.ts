import { QueryClient } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { browserPushCapability, prefetchBrowserPushCapability } from "./browser-push-capability";

const IPHONE_SAFARI_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

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
    for (const fn of restore.reverse()) {
      fn();
    }
  });
}

function queryClientResource() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return makeResource(queryClient, () => {
    queryClient.clear();
  });
}

test("reports unsupported when the browser has no push APIs", async () => {
  await using queryClient = queryClientResource();

  const capability = await queryClient.fetchQuery(browserPushCapability());

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

  const capability = await queryClient.fetchQuery(browserPushCapability());

  expect(capability).toEqual({ kind: "needsIosInstall" });
});

test("reports unsupported when PushManager is missing", async () => {
  await using queryClient = queryClientResource();
  await using _env = stubBrowserPush({
    hasPushManager: false,
    hasNotification: true,
    hasServiceWorker: true,
  });

  const capability = await queryClient.fetchQuery(browserPushCapability());

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

  const capability = await queryClient.fetchQuery(browserPushCapability());

  expect(capability).toEqual({ kind: "unsubscribed" });
});

test("returns the existing browser push subscription", async () => {
  await using queryClient = queryClientResource();
  const subscription = {
    endpoint: "https://push.example/subscription",
  } as PushSubscription;
  await using _env = stubBrowserPush({
    hasPushManager: true,
    hasNotification: true,
    hasServiceWorker: true,
    subscription,
  });

  const capability = await queryClient.fetchQuery(browserPushCapability());

  expect(capability).toEqual({ kind: "subscribed", subscription });
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

  const capability = await queryClient.fetchQuery(browserPushCapability());

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

  const pending = queryClient.fetchQuery(browserPushCapability());
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

  const capability = await queryClient.fetchQuery(browserPushCapability());

  expect(capability).toEqual({ kind: "unsubscribed" });
});

test("keeps a stable query key for loader prefetch and useQuery", () => {
  expect(browserPushCapability().queryKey).toEqual(["browserPushCapability"]);
  expect(browserPushCapability().queryKey).toEqual(browserPushCapability().queryKey);
});

test("prefetches the capability into the query cache in the browser", async () => {
  await using queryClient = queryClientResource();

  const handle = prefetchBrowserPushCapability(queryClient);

  expect(handle).toMatchObject({ input: undefined });
  await vi.waitFor(() => {
    expect(queryClient.getQueryData(browserPushCapability().queryKey)).toEqual({
      kind: "unsupported",
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
  const handle = prefetchBrowserPushCapability(queryClient);

  expect(handle).toMatchObject({ input: undefined });
  expect(ensureSpy).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(browserPushCapability().queryKey)).toBeUndefined();
});
