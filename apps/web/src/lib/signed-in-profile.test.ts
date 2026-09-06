import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { loadSignedInProfile } from "@/lib/signed-in-profile";

const profileKey = convexQuery(api.profile.get, {}).queryKey;
const babyListKey = convexQuery(api.baby.listByUser, {}).queryKey;

type ProfileCtx = {
  convexClient:
    | { setAuth: (fetchToken: () => Promise<string | null>) => void }
    | Record<string, never>;
  convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
  convexQueryClient: {
    queryOptions: typeof convexQuery;
    serverHttpClient: { setAuth: (token: string) => void };
  };
  queryClient: QueryClient;
  token: string | null;
};

type ProfileSnapshot = {
  isAdmin: boolean;
  locale: string;
  timeZone: string;
};

const signedInProfile: ProfileSnapshot = {
  isAdmin: false,
  locale: "sv",
  timeZone: "Europe/London",
};

function makeProfileCtx() {
  const queryFn = vi.fn<() => Promise<null | ProfileSnapshot>>(() => Promise.resolve(null));
  const queryClient = new QueryClient({
    defaultOptions: { queries: { queryFn, retry: false } },
  });
  const context: ProfileCtx = {
    convexClient: {},
    convexPreloader: getConvexQueryPreloader(queryClient),
    convexQueryClient: {
      queryOptions: convexQuery,
      serverHttpClient: { setAuth: vi.fn<(token: string) => void>() },
    },
    queryClient,
    token: null,
  };
  return { context, queryClient, queryFn };
}

async function load(opts: {
  catchUpSignal: AbortSignal | null;
  context: ProfileCtx;
  fetchToken: () => Promise<string | null>;
}) {
  return await loadSignedInProfile({
    catchUpSignal: opts.catchUpSignal,
    // SAFETY: Test fixture is a subset of the production type.
    context: opts.context as Parameters<typeof loadSignedInProfile>[0]["context"],
    fetchToken: opts.fetchToken,
  });
}

test("stale anonymous cache with a cookie waits for Convex to flip profile.get", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("jwt");
  const profile = makeProfileCtx();
  profile.queryClient.setQueryData(profileKey, null);
  profile.queryClient.setQueryData(babyListKey, []);

  const pending = load({
    catchUpSignal: AbortSignal.timeout(5000),
    context: profile.context,
    fetchToken,
  });
  await vi.waitFor(() => {
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
  // The mounted provider re-authenticates the websocket and Convex pushes
  // the signed-in snapshot into the shared cache.
  profile.queryClient.setQueryData(profileKey, signedInProfile);

  const result = await pending;

  expect(result).toMatchObject({
    locale: "sv",
    token: "jwt",
  });
  expect(profile.queryFn).not.toHaveBeenCalled();
  // Identity changed: anonymous-scoped results are dropped, me is kept.
  expect(profile.queryClient.getQueryData(profileKey)).toEqual(signedInProfile);
  expect(profile.queryClient.getQueryData(babyListKey)).toBeUndefined();
});

test("anonymous cache with no cookie bounces without waiting on Convex", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
  const profile = makeProfileCtx();
  profile.queryClient.setQueryData(profileKey, null);
  profile.queryClient.setQueryData(babyListKey, []);

  const result = await load({
    catchUpSignal: null,
    context: profile.context,
    fetchToken,
  });

  expect(result).toBeNull();
  expect(fetchToken).toHaveBeenCalledTimes(1);
  expect(profile.queryFn).not.toHaveBeenCalled();
  expect(profile.queryClient.getQueryData(babyListKey)).toEqual([]);
});

test("cookie without a Convex identity within the budget still bounces", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>().mockResolvedValue("jwt");
  const profile = makeProfileCtx();
  profile.queryClient.setQueryData(babyListKey, []);
  const budget = new AbortController();

  const pending = load({
    catchUpSignal: budget.signal,
    context: profile.context,
    fetchToken,
  });
  await vi.waitFor(() => {
    expect(fetchToken).toHaveBeenCalledTimes(1);
  });
  budget.abort();

  const result = await pending;

  expect(result).toBeNull();
  // Missing cache entry was fetched once (anonymous), then never refetched.
  expect(profile.queryFn).toHaveBeenCalledTimes(1);
  expect(profile.queryClient.getQueryData(profileKey)).toBeNull();
  expect(profile.queryClient.getQueryData(babyListKey)).toEqual([]);
});

test("cached present profile returns without a cookie round-trip", async () => {
  const fetchToken = vi.fn<() => Promise<string | null>>();
  const profile = makeProfileCtx();
  profile.queryClient.setQueryData(profileKey, signedInProfile);
  profile.context.token = "ctx-token";

  const result = await load({
    catchUpSignal: null,
    context: profile.context,
    fetchToken,
  });

  expect(result).toMatchObject({
    locale: "sv",
    token: "ctx-token",
  });
  expect(fetchToken).not.toHaveBeenCalled();
  expect(profile.queryFn).not.toHaveBeenCalled();
});
