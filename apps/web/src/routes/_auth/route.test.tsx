import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";

const getToken = vi.hoisted(() => vi.fn<() => Promise<string | null>>());

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (opts: unknown) => opts,
  Outlet: () => null,
  redirect: (opts: unknown) => ({ isRedirect: true, ...(opts as object) }),
}));

vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

vi.mock("@/lib/auth-server", () => ({
  authServer: { getToken },
}));

const { Route } = await import("@/routes/_auth/route");

type GuardCtx = {
  context: {
    queryClient: QueryClient;
    convexClient: unknown;
    token: string | null;
    locale: string;
  };
};

function makeGuardCtx() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, queryFn: () => Promise.resolve(null) } },
  });
  const ctx: GuardCtx = {
    context: { queryClient, convexClient: {}, token: null, locale: "en-GB" },
  };
  const options = Route as unknown as {
    beforeLoad: (opts: GuardCtx) => Promise<{ locale: string; isAuthenticated: boolean }>;
  };
  return { ctx, queryClient, beforeLoad: options.beforeLoad };
}

test("client navigations with a cached profile skip the token round-trip", async () => {
  getToken.mockReset();
  const guard = makeGuardCtx();
  guard.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, {
    locale: "sv",
    isAdmin: false,
  });

  const result = await guard.beforeLoad(guard.ctx);

  expect(result).toMatchObject({ locale: "sv", isAuthenticated: true });
  expect(getToken).not.toHaveBeenCalled();
});

test("client navigations without a session redirect home after one token check", async () => {
  getToken.mockReset();
  getToken.mockResolvedValueOnce(null);
  const guard = makeGuardCtx();

  await expect(guard.beforeLoad(guard.ctx)).rejects.toMatchObject({
    isRedirect: true,
    to: "/",
  });
  expect(getToken).toHaveBeenCalledTimes(1);
});
