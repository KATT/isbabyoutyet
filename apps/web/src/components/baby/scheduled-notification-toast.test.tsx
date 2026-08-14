import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { testPreloadedQuery } from "@workspace/query-prefetch/test-helpers";
import { pushSubscriptionsForBaby, scheduledNotificationsForBaby } from "@/queries/convex";

const mocks = vi.hoisted(() => ({
  useSuspenseQuery: vi.fn<(options: { initialData: unknown }) => { data: unknown }>(),
  custom: vi.fn<(...args: unknown[]) => string | number>(),
  dismiss: vi.fn<(id: string | number | undefined) => void>(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useSuspenseQuery: (options: { initialData: unknown }) => mocks.useSuspenseQuery(options),
  };
});

vi.mock("sonner", () => ({
  toast: {
    custom: mocks.custom,
    dismiss: mocks.dismiss,
    success: vi.fn<(message: string) => void>(),
  },
}));

const { ScheduledNotificationToast } = await import("./scheduled-notification-toast");

const babyId = "jd7baby000000000000000000" as Id<"baby">;

function renderResource(ui: React.ReactElement) {
  const view = render(ui);
  return makeResource(view, () => {
    view.unmount();
  });
}

test("runs with empty notifications and subscriptions", async () => {
  const notifications = testPreloadedQuery(scheduledNotificationsForBaby, [], { babyId });
  const subscriptions = testPreloadedQuery(pushSubscriptionsForBaby, [], { babyId });
  mocks.useSuspenseQuery.mockImplementation((options) => ({
    data: options.initialData,
  }));

  await using view = renderResource(
    <ScheduledNotificationToast notifications={notifications} subscriptions={subscriptions} />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(mocks.custom).not.toHaveBeenCalled();
});

test("shows a countdown toast when a pending notification has subscribers", async () => {
  const notificationId = "jd7sched0000000000000000" as Id<"scheduledNotifications">;
  const notifications = testPreloadedQuery(
    scheduledNotificationsForBaby,
    [
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
    { babyId },
  );
  const subscriptions = testPreloadedQuery(
    pushSubscriptionsForBaby,
    [
      {
        _id: "jd7push00000000000000000" as Id<"pushSubscriptions">,
        _creationTime: Date.now(),
        babyId,
        createdAt: Date.now(),
        endpoint: "https://push.example/sub",
        p256dh: "key",
        auth: "auth",
      },
    ],
    { babyId },
  );
  mocks.useSuspenseQuery.mockImplementation((options) => ({
    data: options.initialData,
  }));

  await using view = renderResource(
    <ScheduledNotificationToast notifications={notifications} subscriptions={subscriptions} />,
  );

  expect(view.container.firstChild).toBeNull();
  expect(mocks.custom).toHaveBeenCalled();
});
