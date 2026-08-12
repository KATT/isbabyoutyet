import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { useQuery as useConvexQuery } from "convex/react";
import { toast } from "sonner";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { NotificationSubscribe } from "./notification-subscribe";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    promise: vi.fn((promise: Promise<unknown>, opts?: { error?: (error: unknown) => string }) => {
      // Exercise the error-message callback like real sonner would
      promise.catch((error) => opts?.error?.(error));
    }),
  },
}));

const convexMutationMock = vi.fn(async () => null);

vi.mock("convex/react", () => ({
  useConvex: () => ({ mutation: convexMutationMock }),
  useQuery: vi.fn(),
}));

const BABY_ID = "baby-1" as Id<"baby">;
// Valid base64url VAPID-style key
const VAPID_KEY =
  "BEl62iUYgUivxIkv69yViEuiBIa40HI80NM9f8HnKJuOmLWjMpS_PiA-VE0BBAtZ2craVg2sCYCiWQMEQ2ivybM";

function renderWithQueryClient(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const view = render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
  return makeResource({ view, queryClient }, () => {
    view.unmount();
  });
}

/** Wait until all TanStack queries (browser support detection etc.) settled. */
async function waitForIdle(queryClient: QueryClient) {
  await vi.waitFor(() => {
    expect(queryClient.isFetching()).toBe(0);
  });
}

type BrowserEnvOptions = {
  userAgent?: string;
  standalone?: boolean;
  serviceWorker?: false | { registration?: unknown; rejectReady?: boolean };
  notificationPermission?: NotificationPermission;
  requestPermissionResult?: NotificationPermission;
  browserSubscription?: { endpoint: string } | null;
};

function useBrowserEnv(opts: BrowserEnvOptions) {
  vi.clearAllMocks();
  const originalUserAgent = navigator.userAgent;
  const subscribeMock = vi.fn(async () => ({
    toJSON: () => ({
      endpoint: "https://push.example.com/browser-sub",
      keys: { p256dh: "p256dh-key", auth: "auth-key" },
    }),
  }));

  Object.defineProperty(window.navigator, "userAgent", {
    value: opts.userAgent ?? "Mozilla/5.0 (X11; Linux x86_64) Chrome/120",
    configurable: true,
  });
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: opts.standalone ?? false })),
  );

  if (opts.serviceWorker !== false) {
    const registration = opts.serviceWorker?.registration ?? {
      pushManager: {
        getSubscription: async () => opts.browserSubscription ?? null,
        subscribe: subscribeMock,
      },
    };
    let ready: Promise<unknown>;
    if (opts.serviceWorker?.rejectReady) {
      ready = Promise.reject(new Error("no service worker"));
      // Pre-attach a handler so the rejection is never "unhandled"
      ready.catch(() => {});
    } else {
      ready = Promise.resolve(registration);
    }
    Object.defineProperty(window.navigator, "serviceWorker", {
      value: { ready },
      configurable: true,
    });
    vi.stubGlobal("PushManager", class {});
  }

  const requestPermissionMock = vi.fn(async () => opts.requestPermissionResult ?? "granted");
  vi.stubGlobal("Notification", {
    permission: opts.notificationPermission ?? "default",
    requestPermission: requestPermissionMock,
  });

  return makeResource({ subscribeMock, requestPermissionMock }, () => {
    vi.unstubAllGlobals();
    Object.defineProperty(window.navigator, "userAgent", {
      value: originalUserAgent,
      configurable: true,
    });
    // Remove the fake service worker so the next test starts clean
    delete (window.navigator as { serviceWorker?: unknown }).serviceWorker;
    convexMutationMock.mockReset();
    convexMutationMock.mockResolvedValue(null);
  });
}

test("iOS Safari outside a PWA shows install instructions instead of subscribing", async () => {
  await using _env = useBrowserEnv({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
    standalone: false,
    serviceWorker: false,
  });
  vi.mocked(useConvexQuery).mockReturnValue(undefined as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  expect(await screen.findByText("Get Notifications on iOS")).toBeTruthy();
  expect(rendered.view.getByText(/Add to Home Screen/)).toBeTruthy();
});

test("subscribing requests permission, subscribes the browser and saves to Convex", async () => {
  await using env = useBrowserEnv({
    notificationPermission: "default",
    requestPermissionResult: "granted",
    browserSubscription: null,
  });
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  await vi.waitFor(() => {
    expect(convexMutationMock).toHaveBeenCalledWith(expect.anything(), {
      babyId: BABY_ID,
      endpoint: "https://push.example.com/browser-sub",
      p256dh: "p256dh-key",
      auth: "auth-key",
    });
  });
  expect(env.requestPermissionMock).toHaveBeenCalled();
  expect(env.subscribeMock).toHaveBeenCalledWith(
    expect.objectContaining({ userVisibleOnly: true }),
  );
});

test("a denied permission never reaches Convex", async () => {
  await using env = useBrowserEnv({
    notificationPermission: "default",
    requestPermissionResult: "denied",
  });
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  await vi.waitFor(() => {
    expect(env.requestPermissionMock).toHaveBeenCalled();
  });
  expect(convexMutationMock).not.toHaveBeenCalled();
});

test("an already-subscribed visitor can unsubscribe", async () => {
  await using _env = useBrowserEnv({
    notificationPermission: "granted",
    browserSubscription: { endpoint: "https://push.example.com/existing" },
  });
  vi.mocked(useConvexQuery).mockReturnValue(true as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Unsubscribe/ }));

  await vi.waitFor(() => {
    expect(convexMutationMock).toHaveBeenCalledWith(expect.anything(), {
      endpoint: "https://push.example.com/existing",
    });
  });
});

test("an unsupported browser fails the subscribe flow gracefully", async () => {
  await using _env = useBrowserEnv({
    serviceWorker: false,
  });
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  await vi.waitFor(() => {
    expect(toast.promise).toHaveBeenCalled();
  });
  expect(convexMutationMock).not.toHaveBeenCalled();
});

test("shows a spinner while the unsubscribe mutation is pending", async () => {
  await using _env = useBrowserEnv({
    notificationPermission: "granted",
    browserSubscription: { endpoint: "https://push.example.com/existing" },
  });
  // Keep the mutation hanging so the pending state is observable
  convexMutationMock.mockReturnValue(new Promise(() => {}) as never);
  vi.mocked(useConvexQuery).mockReturnValue(true as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Unsubscribe/ }));

  await vi.waitFor(() => {
    const button = screen.getByRole("button", { name: /Unsubscribe/ });
    expect(button.hasAttribute("disabled")).toBe(true);
  });
});

test("an installed iOS PWA gets the regular subscribe button", async () => {
  await using _env = useBrowserEnv({
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Safari/604.1",
    standalone: true,
    notificationPermission: "granted",
    browserSubscription: null,
  });
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));
  expect(screen.queryByText("Get Notifications on iOS")).toBeNull();
});

test("an outright denied permission fails without prompting again", async () => {
  await using env = useBrowserEnv({
    notificationPermission: "denied",
  });
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  await vi.waitFor(() => {
    expect(toast.promise).toHaveBeenCalled();
  });
  expect(env.requestPermissionMock).not.toHaveBeenCalled();
  expect(convexMutationMock).not.toHaveBeenCalled();
});

test("an already-granted permission skips the prompt and subscribes", async () => {
  await using env = useBrowserEnv({
    notificationPermission: "granted",
    browserSubscription: null,
  });
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  await vi.waitFor(() => {
    expect(convexMutationMock).toHaveBeenCalled();
  });
  expect(env.requestPermissionMock).not.toHaveBeenCalled();
});

test("a browser subscription without keys never reaches Convex", async () => {
  await using env = useBrowserEnv({
    notificationPermission: "granted",
    browserSubscription: null,
  });
  env.subscribeMock.mockResolvedValueOnce({
    toJSON: () => ({ endpoint: "https://push.example.com/broken" }),
  } as never);
  vi.mocked(useConvexQuery).mockReturnValue(false as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Get Notifications/ }));

  await vi.waitFor(() => {
    expect(env.subscribeMock).toHaveBeenCalled();
  });
  await vi.waitFor(() => {
    expect(convexMutationMock).not.toHaveBeenCalled();
  });
});

test("unsubscribing without a browser subscription shows an error", async () => {
  await using _env = useBrowserEnv({
    notificationPermission: "granted",
    serviceWorker: { rejectReady: true },
  });
  vi.mocked(useConvexQuery).mockReturnValue(true as never);

  await using rendered = renderWithQueryClient(
    <NotificationSubscribe babyId={BABY_ID} vapidPublicKey={VAPID_KEY} />,
  );
  await waitForIdle(rendered.queryClient);

  fireEvent.click(screen.getByRole("button", { name: /Unsubscribe/ }));

  await vi.waitFor(() => {
    expect(toast.error).toHaveBeenCalledWith("No subscription endpoint found");
  });
  expect(convexMutationMock).not.toHaveBeenCalled();
});
