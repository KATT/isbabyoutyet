import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey, QueryObserver } from "@tanstack/react-query";
import type { FunctionReturnType } from "convex/server";
import { api } from "@workspace/convex/convex/_generated/api";
import { authClient } from "./auth-client";
import { authDebug, debugIdFor } from "./auth-debug";

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

/** TEMPORARY: `profile.get` snapshot type for debug cache reads. */
export type MeSnapshot = FunctionReturnType<typeof api.profile.get>;

/** TEMPORARY: one-word description of a `profile.get` snapshot for the debug log. */
export function describeMe(value: MeSnapshot | undefined) {
  if (value === undefined) {
    return "undefined";
  }
  if (value === null) {
    return "null";
  }
  return "present";
}

/** TEMPORARY: identity of the QueryClient the auth runtime was set up with. */
export function debugAuthRuntimeIds() {
  return {
    runtimeConvexQueryClient: debugIdFor(
      authRuntime?.convexQueryClient ?? null,
      "convexQueryClient",
    ),
    runtimeQueryClient: debugIdFor(authRuntime?.queryClient ?? null, "queryClient"),
  };
}

function clearQueryCacheKeepingMe(queryClient: QueryClient, meKey: QueryKey) {
  queryClient.removeQueries({
    predicate: (query) => !isMeQueryKey(query.queryKey, meKey),
  });
}

type AuthRuntime = {
  authClient: ConvexAuthClient;
  convexClient: Pick<ConvexQueryClient["convexClient"], "setAuth">;
  convexQueryClient: Pick<ConvexQueryClient, "queryOptions">;
  queryClient: QueryClient;
};

let authRuntime: AuthRuntime | null = null;

/** GET `/api/auth/convex/token` — one Vercel → Convex round trip. */
async function fetchConvexToken(client: ConvexAuthClient) {
  const result = await client.convex.token({ fetchOptions: { throw: false } }).catch(() => null);
  return result?.data?.token ?? null;
}

/**
 * Authenticate the Convex websocket straight from a sign-in / sign-up
 * response instead of waiting for `ConvexBetterAuthProvider`.
 *
 * The provider only calls `setAuth` after better-auth's `useSession` has
 * refetched `/get-session`, and then fetches `/convex/token` — two sequential
 * round trips (~450 ms each on a normal connection) before `profile.get` can
 * flip to the signed-in user. The server already minted a JWT during sign-in
 * (`convexTokenInAuthResponse` puts it in the body), so we hand it to Convex
 * immediately; only the websocket confirmation remains. When the body carries
 * no token (older backend), the fetcher falls back to `/convex/token`, which
 * still skips the `/get-session` hop. Convex's own refresh schedule always
 * calls with `forceRefreshToken`, so the inline token is used at most once.
 *
 * The provider still runs its own `setAuth` once `/get-session` lands; that
 * re-confirms the same identity and is harmless.
 */
export function authenticateConvexFromAuthResponse(token: string | null) {
  const runtime = authRuntime;
  if (!runtime) {
    return;
  }
  authDebug("authenticateConvexFromAuthResponse", { hasInlineToken: token !== null });
  let inlineToken = token;
  runtime.convexClient.setAuth(async (args) => {
    if (inlineToken !== null && !args.forceRefreshToken) {
      const once = inlineToken;
      inlineToken = null;
      return once;
    }
    return await fetchConvexToken(runtime.authClient);
  });
}

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
    authClient: opts.authClient,
    convexClient: opts.convexQueryClient.convexClient,
    convexQueryClient: opts.convexQueryClient,
    queryClient: opts.queryClient,
  };
  authDebug("setupClientConvexAuth", {
    convexClient: debugIdFor(opts.convexQueryClient.convexClient, "convexClient"),
    convexQueryClient: debugIdFor(opts.convexQueryClient, "convexQueryClient"),
    queryClient: debugIdFor(opts.queryClient, "queryClient"),
  });
  instrumentConvexClientAuth(opts.convexQueryClient.convexClient);

  opts.convexQueryClient.convexClient.setAuth(async () => {
    const started = Date.now();
    const token = await fetchConvexToken(opts.authClient);
    authDebug("creation-fetcher.token", { hasToken: token !== null, ms: Date.now() - started });
    return token;
  });
}

/** TEMPORARY: log every setAuth/clearAuth on the app Convex client, plus token fetches and auth-change callbacks. */
const instrumentedClients = new WeakSet<ConvexQueryClient["convexClient"]>();

function instrumentConvexClientAuth(client: ConvexQueryClient["convexClient"]) {
  if (instrumentedClients.has(client)) {
    return;
  }
  instrumentedClients.add(client);
  const clientId = debugIdFor(client, "convexClient");
  const originalSetAuth = client.setAuth.bind(client);
  const originalClearAuth = client.clearAuth?.bind(client);
  let setAuthSeq = 0;
  client.setAuth = (fetchToken, onChange) => {
    setAuthSeq += 1;
    const seq = setAuthSeq;
    authDebug("convex.setAuth", { clientId, seq, stack: callerHint() });
    return originalSetAuth(
      async (args) => {
        const started = Date.now();
        const token = await fetchToken(args);
        authDebug("convex.fetchToken", {
          clientId,
          forceRefreshToken: args?.forceRefreshToken ?? false,
          hasToken: token !== null && token !== undefined && token.length > 0,
          ms: Date.now() - started,
          seq,
        });
        return token;
      },
      (isAuthenticated) => {
        authDebug("convex.onAuthChange", { clientId, isAuthenticated, seq });
        onChange?.(isAuthenticated);
      },
    );
  };
  if (originalClearAuth) {
    client.clearAuth = () => {
      authDebug("convex.clearAuth", { clientId, stack: callerHint() });
      originalClearAuth();
    };
  }
}

function callerHint() {
  const stack = new Error("hint").stack ?? "";
  return stack.split("\n").slice(3, 6).join(" | ").replaceAll(/\s+/g, " ").slice(0, 300);
}

/**
 * How long login/signup/logout wait for `profile.get` to match the expected
 * presence. After a sign-in response the identity still needs four sequential
 * hops before the query flips: better-auth refetches `/get-session`, the
 * provider calls `setAuth`, Convex fetches the JWT, then the websocket
 * re-authenticates and the server confirms. Measured at ~2.1 s on a normal
 * connection, so the budget must cover several seconds; it only exists so a
 * stuck websocket cannot pin the submit button forever (`/_auth` no longer has
 * its own catch-up).
 *
 * @internal Exported for tests.
 */
export const SETTLED_ME_WAIT_MS = 10_000;

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
  const started = Date.now();
  const cachedState = opts.queryClient.getQueryState<MeSnapshot>(meQuery.queryKey);
  authDebug("waitForMe.start", {
    cachedData: describeMe(cachedState?.data),
    cachedUpdatedAt: cachedState?.dataUpdatedAt ?? null,
    presence: opts.presence,
    queryClient: debugIdFor(opts.queryClient, "queryClient"),
    queryHash:
      opts.queryClient.getQueryCache().find({ queryKey: meQuery.queryKey })?.queryHash ?? null,
  });

  return new Promise<void>((resolve) => {
    let settled = false;
    const finish = (matched: boolean) => {
      if (settled) {
        return;
      }
      settled = true;
      unsubscribe();
      observer.destroy();
      authDebug("waitForMe.finish", {
        matched,
        ms: Date.now() - started,
        presence: opts.presence,
        reason: stop.signal.aborted ? "matched" : "external-abort/timeout",
      });
      if (matched) {
        clearQueryCacheKeepingMe(opts.queryClient, meQuery.queryKey);
      }
      resolve();
    };

    const onResult = () => {
      const result = observer.getCurrentResult();
      authDebug("waitForMe.result", {
        data: describeMe(result.data),
        dataUpdatedAt: result.dataUpdatedAt,
        fetchStatus: result.fetchStatus,
        isError: result.isError,
        isPending: result.isPending,
        ms: Date.now() - started,
      });
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
    authDebug("waitForMe.noRuntime", { presence: opts.presence });
    return Promise.resolve();
  }
  authDebug("waitForMe.called", {
    presence: opts.presence,
    queryClient: debugIdFor(opts.queryClient, "queryClient"),
    sameQueryClientAsRuntime: runtime.queryClient === opts.queryClient,
  });
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
