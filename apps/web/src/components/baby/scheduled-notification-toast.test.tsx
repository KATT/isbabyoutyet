import { render } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { makeResource } from "@workspace/convex/convex/test.resource";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import type { useConvexSuspenseQuery } from "@/lib/convex-query";

const mocks = vi.hoisted(() => ({
  useConvexSuspenseQuery:
    vi.fn<
      (
        ...args: Parameters<typeof useConvexSuspenseQuery>
      ) => ReturnType<typeof useConvexSuspenseQuery>
    >(),
  custom: vi.fn<(...args: unknown[]) => string | number>(),
  dismiss: vi.fn<(id: string | number | undefined) => void>(),
}));

vi.mock("@/lib/convex-query", () => ({
  useConvexSuspenseQuery: mocks.useConvexSuspenseQuery,
  ensureConvexQuery: vi.fn(),
}));

vi.mock("sonner", () => ({
  toast: {
    custom: mocks.custom,
    dismiss: mocks.dismiss,
    success: vi.fn(),
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
  mocks.useConvexSuspenseQuery.mockImplementation(
    () =>
      ({
        data: [],
      }) as ReturnType<typeof useConvexSuspenseQuery>,
  );

  await using view = renderResource(<ScheduledNotificationToast babyId={babyId} />);

  expect(view.container.firstChild).toBeNull();
  expect(mocks.custom).not.toHaveBeenCalled();
});
