import { act, fireEvent, render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { api } from "@workspace/convex/convex/_generated/api";
import { testPreloadedConvexQuery } from "@workspace/convex-prefetch/test-helpers";

const mocks = vi.hoisted(() => ({
  useSuspenseQuery: vi.fn<(options: { initialData: unknown }) => { data: unknown }>(),
  mutate: vi.fn<(args: unknown) => void>(),
}));

vi.mock("@tanstack/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-query")>();
  return {
    ...actual,
    useSuspenseQuery: (options: { initialData: unknown }) => mocks.useSuspenseQuery(options),
    useMutation: () => ({ isPending: false, mutate: mocks.mutate }),
  };
});

vi.mock("@convex-dev/react-query", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@convex-dev/react-query")>();
  return {
    ...actual,
    useConvexMutation: () => vi.fn<() => Promise<null>>().mockResolvedValue(null),
  };
});

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn<(message: string) => void>(),
    error: vi.fn<(message: string) => void>(),
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

test("runs with empty notifications and no subscriptions", async () => {
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
  mocks.useSuspenseQuery.mockImplementation((options) => ({
    data: options.initialData,
  }));

  await using view = renderResource(
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.firstChild).toBeNull();
});

test("shows the exact subscriber count in a pending notification toast", async () => {
  mocks.mutate.mockClear();
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
  mocks.useSuspenseQuery.mockImplementation((options) => ({
    data: options.initialData,
  }));

  await using view = renderResource(
    <ScheduledNotificationToast
      notifications={notifications}
      subscriptionCount={subscriptionCount}
    />,
  );

  expect(view.container.textContent).toContain("3 people");
  expect(view.container.textContent).toContain("Sending notification...");
  fireEvent.click(view.getByRole("button", { name: "Cancel" }));
  expect(mocks.mutate).toHaveBeenCalledWith({ notificationId });
});

test("shows a pending-to-sent transition for four seconds without replaying history", async () => {
  vi.useFakeTimers({ now: new Date("2026-08-18T00:00:00.000Z") });
  await using _timers = makeResource({}, () => vi.useRealTimers());
  const notificationId = "jd7sched0000000000000001" as Id<"scheduledNotifications">;
  const scheduledFor = Date.now() - 10_000;
  const notification = {
    _id: notificationId,
    _creationTime: Date.now(),
    babyId,
    createdAt: Date.now(),
    notificationType: "born" as const,
    scheduledFor,
    customMessage: null,
    scheduledId: "sched-2" as Id<"_scheduled_functions">,
  };
  const notificationHandle = (status: "pending" | "sent") =>
    testPreloadedConvexQuery<typeof api.baby.getScheduledNotifications>({
      input: { babyId },
      initialData: [{ ...notification, status }],
    });
  const subscriptionCount = testPreloadedConvexQuery<
    typeof api.pushSubscriptions.getSubscriptionCount
  >({
    input: { babyId },
    initialData: 1,
  });
  mocks.useSuspenseQuery.mockImplementation((options) => ({
    data: options.initialData,
  }));

  await using view = renderResource(
    <ScheduledNotificationToast
      notifications={notificationHandle("sent")}
      subscriptionCount={subscriptionCount}
    />,
  );
  expect(view.queryByText("Notification sent!")).toBeNull();

  view.rerender(
    <ScheduledNotificationToast
      notifications={notificationHandle("pending")}
      subscriptionCount={subscriptionCount}
    />,
  );
  expect(view.getByText("Sending notification...")).toBeTruthy();

  view.rerender(
    <ScheduledNotificationToast
      notifications={notificationHandle("sent")}
      subscriptionCount={subscriptionCount}
    />,
  );
  expect(view.getByText("Notification sent!")).toBeTruthy();
  expect(view.container.textContent).toContain("1 person");

  act(() => vi.advanceTimersByTime(3999));
  expect(view.getByText("Notification sent!")).toBeTruthy();
  act(() => vi.advanceTimersByTime(1));
  expect(view.queryByText("Notification sent!")).toBeNull();
});
