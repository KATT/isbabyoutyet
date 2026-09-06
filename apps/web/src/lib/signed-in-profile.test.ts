import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { loadSignedInProfile } from "@/lib/signed-in-profile";

type ProfileSnapshot = {
  isAdmin: boolean;
  locale: string;
  timeZone: string;
};

const adaProfile = {
  isAdmin: false,
  locale: "sv",
  timeZone: "Europe/Stockholm",
} as const satisfies ProfileSnapshot;

type ProfileCtx = {
  convexClient:
    | { setAuth: (fetchToken: () => Promise<string | null>) => void }
    | Record<string, never>;
  convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
  convexQueryClient: {
    serverHttpClient: { setAuth: (token: string) => void };
  };
  queryClient: QueryClient;
  token: string | null;
};

function makeProfileCtx() {
  const queryFn = vi.fn<() => Promise<null | ProfileSnapshot>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { queryFn, retry: false } },
  });
  const context: ProfileCtx = {
    convexClient: {},
    convexPreloader: getConvexQueryPreloader(queryClient),
    convexQueryClient: { serverHttpClient: { setAuth: vi.fn() } },
    queryClient,
    token: null,
  };
  return { context, queryClient, queryFn };
}

test("a stale anonymous profile with a session cookie waits for Convex instead of looking logged out", async () => {
  const ctx = makeProfileCtx();
  ctx.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, null);
  ctx.queryFn.mockResolvedValueOnce(adaProfile);
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("jwt");

  const result = await loadSignedInProfile({
    // SAFETY: Test fixture is a subset of the production type.
    context: ctx.context as Parameters<typeof loadSignedInProfile>[0]["context"],
    fetchToken,
  });

  expect(result).toMatchObject({ locale: "sv", token: "jwt" });
  expect(fetchToken).toHaveBeenCalledTimes(1);
  expect(ctx.queryFn).toHaveBeenCalled();
});

test("a missing profile with no session cookie is logged out without waiting on Convex", async () => {
  const ctx = makeProfileCtx();
  ctx.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, null);
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);

  const result = await loadSignedInProfile({
    // SAFETY: Test fixture is a subset of the production type.
    context: ctx.context as Parameters<typeof loadSignedInProfile>[0]["context"],
    fetchToken,
  });

  expect(result).toBeNull();
  expect(fetchToken).toHaveBeenCalledTimes(1);
  expect(ctx.queryFn).not.toHaveBeenCalled();
});
