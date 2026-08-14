import { expect, test, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Outlet: () => null,
  redirect: (opts: unknown) => opts,
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({
    handler: (fn: unknown) => fn,
  }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken: vi.fn<() => Promise<string | null>>() },
}));

const { Route } = await import("@/routes/_auth/route");

test("client navigations with a warm profile skip the network guard entirely", async () => {
  const query = vi.fn<() => Promise<unknown>>();
  const convexClient = {
    watchQuery: () => ({
      localQueryResult: () => ({ locale: "sv", isAdmin: false }),
      onUpdate: () => () => {},
    }),
    query,
  } as unknown as ConvexReactClient;

  const options = Route as unknown as {
    beforeLoad: (opts: { context: { convexClient: ConvexReactClient } }) => Promise<unknown>;
  };
  const result = await options.beforeLoad({ context: { convexClient } });

  expect(result).toEqual({ locale: "sv" });
  expect(query).not.toHaveBeenCalled();
});
