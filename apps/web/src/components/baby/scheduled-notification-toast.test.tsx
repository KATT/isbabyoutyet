import { toast } from "sonner";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { api } from "@workspace/convex/convex/_generated/api";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import {
  seedOwnedBaby,
  seedPendingLaborNotification,
  seedPushSubscriptions,
  signUpTestUser,
} from "@/test/convexTestSeed";
import { renderWithConvexTest } from "@/test/renderWithConvexTest";
import { ScheduledNotificationToast } from "./scheduled-notification-toast";

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

async function renderToastResource(
  harness: Awaited<ReturnType<typeof createConvexTestHarness>>,
  ui: React.ReactElement,
) {
  return renderWithConvexTest({ harness, ui, wrap: null });
}

test("runs with empty notifications and no subscriptions", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: ownerId });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const notifications = await harness.convexPreloader.ensureQueryData(
    api.baby.getScheduledNotifications,
    { babyId: baby.babyId },
  );
  const subscriptionCount = await harness.convexPreloader.ensureQueryData(
    api.pushSubscriptions.getSubscriptionCount,
    { babyId: baby.babyId },
  );

  await using toastSpy = spyOnToastResource();
  await using view = await renderToastResource(
    harness,
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(toastSpy.custom).not.toHaveBeenCalled();
});

test("treats forbidden notification data as empty", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: ownerId });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const visitorId = await signUpTestUser(harness, {
    email: "visitor@example.com",
    password: "password123",
    name: "Visitor",
  });
  harness.withIdentity({ subject: visitorId });

  const notifications = await harness.convexPreloader.ensureQueryData(
    api.baby.getScheduledNotifications,
    { babyId: baby.babyId },
  );
  const subscriptionCount = await harness.convexPreloader.ensureQueryData(
    api.pushSubscriptions.getSubscriptionCount,
    { babyId: baby.babyId },
  );
  await using toastSpy = spyOnToastResource();
  await using view = await renderToastResource(
    harness,
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(toastSpy.custom).not.toHaveBeenCalled();
});

test("shows the exact subscriber count in a pending notification toast", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: ownerId });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await seedPendingLaborNotification(harness, { babyId: baby.babyId });
  await seedPushSubscriptions(harness, { babyId: baby.babyId, count: 3 });

  const notifications = await harness.convexPreloader.ensureQueryData(
    api.baby.getScheduledNotifications,
    { babyId: baby.babyId },
  );
  const subscriptionCount = await harness.convexPreloader.ensureQueryData(
    api.pushSubscriptions.getSubscriptionCount,
    { babyId: baby.babyId },
  );

  await using toastSpy = spyOnToastResource();
  await using view = await renderToastResource(
    harness,
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(toastSpy.custom).toHaveBeenCalled();
  const renderToast = toastSpy.custom.mock.calls[0]?.[0];
  if (typeof renderToast !== "function") throw new Error("Toast renderer missing");
  await using toastView = await renderWithConvexTest({
    harness,
    ui: renderToast("toast-id") as React.ReactElement,
    wrap: null,
  });
  expect(toastView.container.textContent).toContain("3 people");
});
