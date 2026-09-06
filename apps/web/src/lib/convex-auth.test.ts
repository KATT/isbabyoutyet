import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import {
  authenticateConvexFromAuthResponse,
  setupClientConvexAuthWithClient,
  waitForMe,
  waitForMeQuery,
} from "@/lib/convex-auth";

const profileKey = convexQuery(api.profile.get, {}).queryKey;
const babyListKey = convexQuery(api.baby.listByUser, {}).queryKey;

const signedInProfile = {
  email: "ada@example.com",
  emailVerified: true,
  isAdmin: false,
  locale: "en-GB",
  name: "Ada",
  timeZone: "Europe/London",
} as const;

function makeAuthClient() {
  const token =
    vi.fn<
      (opts: {
        fetchOptions: { throw: boolean };
      }) => Promise<{ data: { token: string } | null } | null>
    >();
  return {
    authClient: { convex: { token } },
    token,
  };
}

function makeClients() {
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const queryOptions = vi.fn(() => ({
    queryFn: async () => null,
    queryKey: profileKey,
    staleTime: Infinity,
  }));
  const convexQueryClient = {
    convexClient: { setAuth },
    queryOptions,
  };
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return { convexQueryClient, queryClient, queryOptions, setAuth };
}

function seedCachedQueries(queryClient: QueryClient, profile: typeof signedInProfile | null) {
  queryClient.setQueryData(profileKey, profile);
  queryClient.setQueryData(babyListKey, []);
}

test("setup establishes auth immediately: token for signed-in, null for anonymous", async () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    // @ts-expect-error — stand-in only implements token({ fetchOptions })
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth + queryOptions
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });

  expect(clients.setAuth).toHaveBeenCalledTimes(1);
  const fetchToken = clients.setAuth.mock.calls[0]?.[0];
  if (!fetchToken) {
    throw new Error("expected a token fetcher");
  }

  auth.token.mockResolvedValueOnce({ data: { token: "jwt" } });
  expect(await fetchToken()).toBe("jwt");

  auth.token.mockResolvedValueOnce({ data: null });
  expect(await fetchToken()).toBeNull();

  auth.token.mockRejectedValueOnce(new Error("token endpoint down"));
  expect(await fetchToken()).toBeNull();
});

test("waitForMeQuery keeps me and drops the rest of the cache when present", async () => {
  const clients = makeClients();
  seedCachedQueries(clients.queryClient, signedInProfile);

  await waitForMeQuery({
    // @ts-expect-error — stand-in only implements queryOptions
    convexQueryClient: clients.convexQueryClient,
    presence: "present",
    queryClient: clients.queryClient,
    signal: AbortSignal.timeout(1000),
  });

  expect(clients.queryClient.getQueryData(profileKey)).toEqual(signedInProfile);
  expect(clients.queryClient.getQueryData(babyListKey)).toBeUndefined();
});

test("waitForMeQuery keeps me and drops the rest of the cache when absent", async () => {
  const clients = makeClients();
  seedCachedQueries(clients.queryClient, null);

  await waitForMeQuery({
    // @ts-expect-error — stand-in only implements queryOptions
    convexQueryClient: clients.convexQueryClient,
    presence: "absent",
    queryClient: clients.queryClient,
    signal: AbortSignal.timeout(1000),
  });

  expect(clients.queryClient.getQueryData(profileKey)).toBeNull();
  expect(clients.queryClient.getQueryData(babyListKey)).toBeUndefined();
});

test("waitForMeQuery leaves the cache alone when the signal is already aborted", async () => {
  const clients = makeClients();
  seedCachedQueries(clients.queryClient, signedInProfile);

  await waitForMeQuery({
    // @ts-expect-error — stand-in only implements queryOptions
    convexQueryClient: clients.convexQueryClient,
    presence: "present",
    queryClient: clients.queryClient,
    signal: AbortSignal.abort(),
  });

  expect(clients.queryClient.getQueryData(profileKey)).toEqual(signedInProfile);
  expect(clients.queryClient.getQueryData(babyListKey)).toEqual([]);
});

test("waitForMeQuery leaves the cache alone when presence never matches", async () => {
  const clients = makeClients();
  seedCachedQueries(clients.queryClient, null);
  const controller = new AbortController();

  const settled = waitForMeQuery({
    // @ts-expect-error — stand-in only implements queryOptions
    convexQueryClient: clients.convexQueryClient,
    presence: "present",
    queryClient: clients.queryClient,
    signal: controller.signal,
  });
  controller.abort();
  await settled;

  expect(clients.queryClient.getQueryData(profileKey)).toBeNull();
  expect(clients.queryClient.getQueryData(babyListKey)).toEqual([]);
});

function setupRuntime() {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    // @ts-expect-error — stand-in only implements token({ fetchOptions })
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth + queryOptions
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });
  clients.setAuth.mockClear();
  return { auth, clients };
}

function lastTokenFetcher(setAuth: ReturnType<typeof makeClients>["setAuth"]) {
  const fetchToken = setAuth.mock.lastCall?.[0] as
    | ((args: { forceRefreshToken: boolean }) => Promise<string | null | undefined>)
    | undefined;
  if (!fetchToken) {
    throw new Error("expected setAuth to receive a token fetcher");
  }
  return fetchToken;
}

test("authenticateConvexFromAuthResponse hands the inline JWT to Convex without a token round trip", async () => {
  const { auth, clients } = setupRuntime();

  authenticateConvexFromAuthResponse("jwt-from-sign-in");

  expect(clients.setAuth).toHaveBeenCalledTimes(1);
  const fetchToken = lastTokenFetcher(clients.setAuth);
  expect(await fetchToken({ forceRefreshToken: false })).toBe("jwt-from-sign-in");
  expect(auth.token).not.toHaveBeenCalled();

  // Convex's refresh schedule and any later call go to the token endpoint.
  auth.token.mockResolvedValue({ data: { token: "refreshed" } });
  expect(await fetchToken({ forceRefreshToken: true })).toBe("refreshed");
  expect(await fetchToken({ forceRefreshToken: false })).toBe("refreshed");
  expect(auth.token).toHaveBeenCalledTimes(2);
});

test("authenticateConvexFromAuthResponse falls back to the token endpoint when the body has no JWT", async () => {
  const { auth, clients } = setupRuntime();
  auth.token.mockResolvedValueOnce({ data: { token: "fetched" } });

  authenticateConvexFromAuthResponse(null);

  const fetchToken = lastTokenFetcher(clients.setAuth);
  expect(await fetchToken({ forceRefreshToken: false })).toBe("fetched");
  expect(auth.token).toHaveBeenCalledTimes(1);
});

test("waitForMe uses the runtime queryOptions after setup", async () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    // @ts-expect-error — stand-in only implements token({ fetchOptions })
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth + queryOptions
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });
  seedCachedQueries(clients.queryClient, signedInProfile);

  await waitForMe({ presence: "present", queryClient: clients.queryClient });

  expect(clients.queryOptions).toHaveBeenCalled();
  expect(clients.queryClient.getQueryData(profileKey)).toEqual(signedInProfile);
  expect(clients.queryClient.getQueryData(babyListKey)).toBeUndefined();
});
