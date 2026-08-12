import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render } from "@testing-library/react";
import { useQuery } from "convex/react";
import { getFunctionName } from "convex/server";
import { toast } from "sonner";
import type { ReactElement } from "react";
import { expect, test, vi } from "vitest";
import { ScheduledNotificationToast } from "./scheduled-notification-toast";
import { renderResource } from "./test-helpers";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { makeResource } from "@workspace/convex/convex/test.resource";

vi.mock("sonner", () => ({
  toast: {
    custom: vi.fn(),
    dismiss: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const convexMutationMock = vi.fn(async () => null);

vi.mock("convex/react", () => ({
  useConvex: () => ({ mutation: convexMutationMock }),
  useQuery: vi.fn(),
}));

const BABY_ID = "baby-1" as Id<"baby">;

type NotificationDoc = {
  _id: Id<"scheduledNotifications">;
  status: "pending" | "sent" | "cancelled";
  notificationType: "labor_started" | "gone_to_hospital" | "born" | "photo_added";
  scheduledFor: number;
};

function makeNotification(
  overrides: Omit<Partial<NotificationDoc>, "_id"> & { _id: string },
): NotificationDoc {
  return {
    status: "pending",
    notificationType: "labor_started",
    scheduledFor: Date.now() + 3000,
    ...overrides,
    _id: overrides._id as Id<"scheduledNotifications">,
  };
}

/** Fresh mock state per test — sonner call counts must not leak across tests. */
function freshMocks(data: { notifications?: NotificationDoc[]; subscriptions?: unknown[] }) {
  vi.clearAllMocks();
  mockQueries(data);
}

function mockQueries(data: { notifications?: NotificationDoc[]; subscriptions?: unknown[] }) {
  vi.mocked(useQuery).mockImplementation(((ref: never) => {
    if (getFunctionName(ref) === "baby:getScheduledNotifications") {
      return data.notifications;
    }
    return data.subscriptions;
  }) as never);
}

function renderToast() {
  return renderResource(render(<ScheduledNotificationToast babyId={BABY_ID} />));
}

function renderToastContent(ui: ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderResource(
    render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>),
  );
}

function lastCustomToastElement(): ReactElement {
  const calls = vi.mocked(toast.custom).mock.calls;
  const renderCallback = calls[calls.length - 1][0];
  return renderCallback("toast-id" as never) as ReactElement;
}

test("does nothing while queries are loading", async () => {
  freshMocks({ notifications: undefined, subscriptions: undefined });
  await using _view = renderToast();
  expect(toast.custom).not.toHaveBeenCalled();
});

test("shows a countdown toast per pending notification with the type label", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1", notificationType: "born" })],
    subscriptions: [{}, {}],
  });
  await using _view = renderToast();

  expect(toast.custom).toHaveBeenCalledTimes(1);
  expect(vi.mocked(toast.custom).mock.calls[0][1]).toMatchObject({
    id: "n1",
    duration: Infinity,
  });

  await using content = renderToastContent(lastCustomToastElement());
  expect(content.getByText("Sending notification...")).toBeTruthy();
  expect(content.getByText(/Baby born/)).toBeTruthy();
  expect(content.getByText(/2 people/)).toBeTruthy();
});

test.each([
  ["labor_started", "Labor started"],
  ["gone_to_hospital", "Gone to hospital"],
  ["photo_added", "Photo added"],
] as const)("labels %s notifications", async (notificationType, label) => {
  freshMocks({
    notifications: [makeNotification({ _id: `n-${notificationType}`, notificationType })],
    subscriptions: [{}],
  });
  await using _view = renderToast();

  await using content = renderToastContent(lastCustomToastElement());
  expect(content.getByText(new RegExp(label))).toBeTruthy();
  expect(content.getByText(/1 person/)).toBeTruthy();
});

test("dismisses all toasts when the last subscriber unsubscribes", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [{}],
  });
  await using view = renderToast();
  expect(toast.custom).toHaveBeenCalledTimes(1);

  mockQueries({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [],
  });
  view.rerender(<ScheduledNotificationToast babyId={BABY_ID} />);

  expect(toast.dismiss).toHaveBeenCalledWith("n1");
});

test("swaps the countdown for a success toast when the notification is sent", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1", notificationType: "born" })],
    subscriptions: [{}],
  });
  await using view = renderToast();
  expect(toast.custom).toHaveBeenCalledTimes(1);

  mockQueries({
    notifications: [makeNotification({ _id: "n1", notificationType: "born", status: "sent" })],
    subscriptions: [{}],
  });
  view.rerender(<ScheduledNotificationToast babyId={BABY_ID} />);

  expect(toast.dismiss).toHaveBeenCalledWith("n1");
  expect(toast.custom).toHaveBeenCalledTimes(2);
  expect(vi.mocked(toast.custom).mock.calls[1][1]).toMatchObject({ duration: 4000 });

  await using content = renderToastContent(lastCustomToastElement());
  expect(content.getByText("Notification sent!")).toBeTruthy();
});

test("the sent toast pluralizes multiple subscribers", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1", notificationType: "born" })],
    subscriptions: [{}, {}, {}],
  });
  await using view = renderToast();

  mockQueries({
    notifications: [makeNotification({ _id: "n1", notificationType: "born", status: "sent" })],
    subscriptions: [{}, {}, {}],
  });
  view.rerender(<ScheduledNotificationToast babyId={BABY_ID} />);

  await using content = renderToastContent(lastCustomToastElement());
  expect(content.getByText(/3 people/)).toBeTruthy();
});

test("a notification that disappears entirely is just dismissed", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [{}],
  });
  await using view = renderToast();
  expect(toast.custom).toHaveBeenCalledTimes(1);

  mockQueries({
    notifications: [],
    subscriptions: [{}],
  });
  view.rerender(<ScheduledNotificationToast babyId={BABY_ID} />);

  expect(toast.dismiss).toHaveBeenCalledWith("n1");
  expect(toast.custom).toHaveBeenCalledTimes(1);
});

test("just dismisses the toast when the notification is cancelled", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [{}],
  });
  await using view = renderToast();
  expect(toast.custom).toHaveBeenCalledTimes(1);

  mockQueries({
    notifications: [makeNotification({ _id: "n1", status: "cancelled" })],
    subscriptions: [{}],
  });
  view.rerender(<ScheduledNotificationToast babyId={BABY_ID} />);

  expect(toast.dismiss).toHaveBeenCalledWith("n1");
  expect(toast.custom).toHaveBeenCalledTimes(1);
});

test("the cancel button cancels the scheduled notification", async () => {
  freshMocks({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [{}],
  });
  await using _view = renderToast();

  await using content = renderToastContent(lastCustomToastElement());
  fireEvent.click(content.getByRole("button", { name: /Cancel/ }));

  // The cancel mutation sleeps for a second before firing
  await vi.waitFor(
    () => {
      expect(convexMutationMock).toHaveBeenCalledWith(expect.anything(), {
        notificationId: "n1",
      });
    },
    { timeout: 3000 },
  );
  await vi.waitFor(() => {
    expect(toast.success).toHaveBeenCalledWith("Notification cancelled");
  });
  expect(toast.dismiss).toHaveBeenCalledWith("n1");
});

test("non-Error cancel failures get a generic message", async () => {
  // eslint-disable-next-line no-throw-literal
  convexMutationMock.mockRejectedValueOnce("boom" as never);
  freshMocks({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [{}],
  });
  await using _view = renderToast();

  await using content = renderToastContent(lastCustomToastElement());
  fireEvent.click(content.getByRole("button", { name: /Cancel/ }));

  await vi.waitFor(
    () => {
      expect(toast.error).toHaveBeenCalledWith("Failed to cancel notification");
    },
    { timeout: 3000 },
  );
});

test("the countdown ticks down to zero", async () => {
  // Freeze time before computing scheduledFor so the math is deterministic
  vi.useFakeTimers({ now: new Date("2026-08-11T12:00:00.000Z") });
  await using _timers = makeResource({}, () => {
    vi.useRealTimers();
  });

  freshMocks({
    notifications: [makeNotification({ _id: "n1", scheduledFor: Date.now() + 3000 })],
    subscriptions: [{}],
  });
  await using _view = renderToast();

  await using content = renderToastContent(lastCustomToastElement());
  expect(content.getByText("3")).toBeTruthy();

  act(() => {
    vi.advanceTimersByTime(1000);
  });
  expect(content.getByText("2")).toBeTruthy();

  act(() => {
    vi.advanceTimersByTime(5000);
  });
  expect(content.getByText("0")).toBeTruthy();
});

test("cancel failures surface as an error toast", async () => {
  convexMutationMock.mockRejectedValueOnce(new Error("Too late") as never);
  freshMocks({
    notifications: [makeNotification({ _id: "n1" })],
    subscriptions: [{}],
  });
  await using _view = renderToast();

  await using content = renderToastContent(lastCustomToastElement());
  fireEvent.click(content.getByRole("button", { name: /Cancel/ }));

  await vi.waitFor(
    () => {
      expect(toast.error).toHaveBeenCalledWith("Too late");
    },
    { timeout: 3000 },
  );
});
