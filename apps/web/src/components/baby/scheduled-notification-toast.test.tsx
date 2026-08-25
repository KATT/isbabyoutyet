import { render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";
import { ScheduledNotificationToast } from "./scheduled-notification-toast";

const babyId = "jd7baby000000000000000000" as Id<"baby">;

/**
 * Sonner queues toasts on a module-level observer with no `<Toaster />`
 * mounted, so the rendered toast body is only reachable through the render
 * callback handed to `toast.custom`.
 */
function spyOnToastResource() {
  const custom = vi.spyOn(toast, "custom").mockReturnValue("toast-id");
  const dismiss = vi.spyOn(toast, "dismiss").mockReturnValue("toast-id");
  return makeResource({ custom, dismiss }, () => {
    custom.mockRestore();
    dismiss.mockRestore();
  });
}

/** Unreachable deployment URL so the render never dials a real Convex backend. */
function renderResource(ui: React.ReactElement) {
  const convexClient = new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  const view = render(
    <ConvexProvider client={convexClient}>
      <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
    </ConvexProvider>,
  );
  return makeResource(view, () => {
    view.unmount();
    queryClient.clear();
  });
}

test("runs with empty notifications and no subscriptions", async () => {
  await using toastSpy = spyOnToastResource();
  const notifications = testPreloadedConvexQuery<typeof api.baby.getScheduledNotifications>({
    input: { babyId },
    initialData: [],
  });
  const subscriptionCount = testPreloadedConvexQuery<
    typeof api.pushSubscriptions.getSubscriptionCount
  >({
    input: { babyId },
    initialData: 0,
  });

  await using view = renderResource(
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(toastSpy.custom).not.toHaveBeenCalled();
});

test("treats forbidden notification data as empty", async () => {
  await using toastSpy = spyOnToastResource();
  const notifications = testPreloadedConvexQuery<typeof api.baby.getScheduledNotifications>({
    input: { babyId },
    initialData: FORBIDDEN,
  });
  const subscriptionCount = testPreloadedConvexQuery<
    typeof api.pushSubscriptions.getSubscriptionCount
  >({
    input: { babyId },
    initialData: FORBIDDEN,
  });

  await using view = renderResource(
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(toastSpy.custom).not.toHaveBeenCalled();
});

test("shows the exact subscriber count in a pending notification toast", async () => {
  await using toastSpy = spyOnToastResource();
  const notificationId = "jd7sched0000000000000000" as Id<"scheduledNotifications">;
  const notifications = testPreloadedConvexQuery<typeof api.baby.getScheduledNotifications>({
    input: { babyId },
    initialData: [
      {
        _id: notificationId,
        _creationTime: Date.now(),
        babyId,
        createdAt: Date.now(),
        status: "pending" as const,
        notificationType: "labor_started" as const,
        scheduledFor: Date.now() + 60_000,
        customMessage: null,
        scheduledId: "sched-1" as Id<"_scheduled_functions">,
      },
    ],
  });
  const subscriptionCount = testPreloadedConvexQuery<
    typeof api.pushSubscriptions.getSubscriptionCount
  >({
    input: { babyId },
    initialData: 3,
  });

  await using view = renderResource(
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(toastSpy.custom).toHaveBeenCalled();
  const renderToast = toastSpy.custom.mock.calls[0]?.[0];
  if (typeof renderToast !== "function") throw new Error("Toast renderer missing");
  await using toastView = renderResource(renderToast("toast-id") as React.ReactElement);
  expect(toastView.container.textContent).toContain("3 people");
});
