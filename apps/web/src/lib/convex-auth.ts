import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey, QueryObserver } from "@tanstack/react-query";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { authClient } from "./auth-client";

type AuthClient = typeof authClient;

/** The subset of `authClient` that `setupClientConvexAuth` depends on. */
export type ConvexAuthClient = {
  convex: Pick<AuthClient["convex"], "token">;
};

export type MePresence = "present" | "absent";

function emptyUnsubscribe() {}

function isMeQueryKey(queryKey: QueryKey, meKey: QueryKey) {
  return hashKey(queryKey) === hashKey(meKey);
}

function meMatchesPresence(
  value: FunctionReturnType<typeof api.profile.get> | undefined,
  presence: MePresence,
) {
  if (value === undefined) {
    return false;
  }
  switch (presence) {
    case "present":
      return value !== null;
    case "absent":
      return value === null;
    default: {
      const _exhaustive: never = presence;
      return _exhaustive;
    }
  }
}

function clearQueryCacheKeepingMe(queryClient: QueryClient, meKey: QueryKey) {
  queryClient.removeQueries({
    predicate: (query) => !isMeQueryKey(query.queryKey, meKey),
  });
}

type AuthRuntime = {
  convexQueryClient: Pick<ConvexQueryClient, "queryOptions">;
  queryClient: QueryClient;
};

let authRuntime: AuthRuntime | null = null;

/**
 * Establishes Convex auth state on the browser client at creation time.
 *
 * `expectAuth` keeps the websocket paused until the first `setAuth`, and
 * convex/react's `ConvexProviderWithAuth` only ever calls `setAuth` for
 * signed-in users — left alone, an anonymous visitor's client-side queries
 * would hang forever. The creation-time fetcher below resolves BOTH states
 * before React even mounts: a token authenticates, no token resumes the
 * socket as anonymous. `ConvexBetterAuthProvider` supersedes this fetcher
 * once its session effect runs and owns login/logout transitions from there.
 *
 * Login, signup, and logout wait on a live `profile.get` ("me") observer,
 * then drop the rest of the query cache so identity-scoped results cannot
 * leak across the boundary.
 *
 * Takes `authClient` as a dependency (defaulted to the real client by
 * {@link setupClientConvexAuth}) so tests can inject a stub without mocking
 * the `@/lib/auth-client` module — the real client's `convex.token()` is a
 * better-auth proxy method that can't be `vi.spyOn`-ed.
 *
 * @internal Exported for tests.
 */
export function setupClientConvexAuthWithClient(opts: {
  authClient: ConvexAuthClient;
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
}) {
  authRuntime = {
    convexQueryClient: opts.convexQueryClient,
    queryClient: opts.queryClient,
  };

  opts.convexQueryClient.convexClient.setAuth(async () => {
    const result = await opts.authClient.convex
      .token({ fetchOptions: { throw: false } })
      .catch(() => null);
    return result?.data?.token ?? null;
  });
}

/**
 * How long login/signup/logout wait for `profile.get` to match the expected
 * presence. Time out so a stuck websocket cannot pin the submit button —
 * `/_auth` still has its own catch-up backoff.
 *
 * @internal Exported for tests.
 */
export const SETTLED_ME_WAIT_MS = 1000;

/**
 * Starts a live `profile.get` observer from Convex React Query
 * `queryOptions` (call this *before* sign-in / sign-up / sign-out) and
 * resolves once the result matches `opts.presence`, or `opts.signal` aborts.
 *
 * On a matching snapshot the query cache is cleared except `profile.get`.
 *
 * @internal Exported for tests.
 */
export function waitForMeQuery(opts: {
  convexQueryClient: Pick<ConvexQueryClient, "queryOptions">;
  presence: MePresence;
  queryClient: QueryClient;
  signal: AbortSignal;
}) {
  if (opts.signal.aborted) {
    return Promise.resolve();
  }

  const meQuery = opts.convexQueryClient.queryOptions(api.profile.get, {});
  const observer = new QueryObserver(opts.queryClient, meQuery);
  const stop = new AbortController();
  const signal = AbortSignal.any([opts.signal, stop.signal]);
  let unsubscribe = emptyUnsubscribe;

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (matched: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      unsubscribe();
      observer.destroy();
      if (matched) {
        clearQueryCacheKeepingMe(opts.queryClient, meQuery.queryKey);
      }
      resolve();
    };

    const onResult = () => {
      const result = observer.getCurrentResult();
      if (result.isPending || result.isError) {
        return;
      }
      if (meMatchesPresence(result.data, opts.presence)) {
        stop.abort();
      }
    };

    unsubscribe = observer.subscribe(onResult);
    onResult();

    const onAbort = () => {
      const result = observer.getCurrentResult();
      finish(!result.isPending && !result.isError && meMatchesPresence(result.data, opts.presence));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
  });
}

/** Wait for the app Convex client’s `profile.get` observer after auth changes. */
export function waitForMe(opts: { presence: MePresence; queryClient: QueryClient }) {
  const runtime = authRuntime;
  if (!runtime) {
    return Promise.resolve();
  }
  return waitForMeQuery({
    convexQueryClient: runtime.convexQueryClient,
    presence: opts.presence,
    queryClient: opts.queryClient,
    signal: AbortSignal.timeout(SETTLED_ME_WAIT_MS),
  });
}

export function setupClientConvexAuth(
  convexQueryClient: ConvexQueryClient,
  queryClient: QueryClient,
) {
  setupClientConvexAuthWithClient({
    authClient,
    convexQueryClient,
    queryClient,
  });
}
