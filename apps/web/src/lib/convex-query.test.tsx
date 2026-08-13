import { expect, test, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/convex/convex/_generated/api";

const mocks = vi.hoisted(() => ({
  convexQuery:
    vi.fn<
      (
        queryRef: unknown,
        args: unknown,
      ) => { queryKey: unknown[]; queryFn: ReturnType<typeof vi.fn> }
    >(),
  useSuspenseQuery: vi.fn<(options: unknown) => { data: string }>(),
  ensureQueryData: vi.fn<() => Promise<unknown>>(),
}));

vi.mock("@convex-dev/react-query", () => ({
  convexQuery: (...args: [unknown, unknown]) => mocks.convexQuery(...args),
}));

vi.mock("@tanstack/react-query", () => ({
  useSuspenseQuery: (...args: [unknown]) => mocks.useSuspenseQuery(...args),
}));

const { ensureConvexQuery, useConvexSuspenseQuery } = await import("@/lib/convex-query");

test("ensureConvexQuery delegates to queryClient.ensureQueryData", async () => {
  mocks.convexQuery.mockImplementation((queryRef, args) => ({
    queryKey: ["convex", queryRef, args],
    queryFn: vi.fn(),
  }));
  mocks.ensureQueryData.mockResolvedValue({ id: "baby-1" });
  const queryClient = {
    ensureQueryData: mocks.ensureQueryData,
  } as unknown as QueryClient;

  const result = await ensureConvexQuery({
    queryClient,
    queryRef: api.baby.listByUser,
    args: {},
  });

  expect(mocks.convexQuery).toHaveBeenCalledWith(api.baby.listByUser, {});
  expect(mocks.ensureQueryData).toHaveBeenCalledWith({
    queryKey: ["convex", api.baby.listByUser, {}],
    queryFn: expect.any(Function),
  });
  expect(result).toEqual({ id: "baby-1" });
});

test("useConvexSuspenseQuery delegates to useSuspenseQuery", () => {
  mocks.convexQuery.mockImplementation((queryRef, args) => ({
    queryKey: ["convex", queryRef, args],
    queryFn: vi.fn(),
  }));
  mocks.useSuspenseQuery.mockReturnValue({ data: "suspense-data" });
  const result = useConvexSuspenseQuery(api.profile.get, {});

  expect(mocks.convexQuery).toHaveBeenCalledWith(api.profile.get, {});
  expect(mocks.useSuspenseQuery).toHaveBeenCalledWith({
    queryKey: ["convex", api.profile.get, {}],
    queryFn: expect.any(Function),
  });
  expect(result.data).toBe("suspense-data");
});
