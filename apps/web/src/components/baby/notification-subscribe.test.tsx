import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { testPreloadedQuery } from "@workspace/query-prefetch/test-helpers";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import type { BrowserPushCapability } from "./browser-push-capability";
import { browserPushCapability } from "./browser-push-capability";

vi.mock("@convex-dev/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/react-query")>();
  return {
    ...actual,
    useConvexMutation: () => vi.fn<() => Promise<null>>().mockResolvedValue(null),
  };
});

vi.mock("@workspace/convex-prefetch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workspace/convex-prefetch")>();
  return {
    ...actual,
    useInitiateConvexQuery: () => ({}),
    usePreloadedConvexQuery: () => ({ data: true }),
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
            vapidPublicKey="vapid-public-key"
            browserPush={testPreloadedQuery(browserPushCapability, capability)}
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

test("shows unsubscribe when the browser already has a push subscription", async () => {
  await using view = renderSubscribe({
    kind: "subscribed",
    subscription: { endpoint: "https://push.example/sub" } as PushSubscription,
  });

  expect(view.getByRole("button", { name: "Unsubscribe" })).toBeTruthy();
});
