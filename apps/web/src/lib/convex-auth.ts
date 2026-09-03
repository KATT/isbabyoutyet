import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { isFunction, isPlainObject } from "@workspace/runtime/guards";
import { authClient } from "./auth-client";

type SessionSnapshot = { data: unknown; isPending: boolean };
type SessionAtom = {
  subscribe: (listener: (session: SessionSnapshot | undefined) => void) => () => void;
};

/** The subset of `authClient` that `setupClientConvexAuth` depends on. */
export type ConvexAuthClient = {
  $store: {
    atoms: {
      session: SessionAtom | undefined;
    };
  };
  convex: {
    token: (opts: {
      fetchOptions: { throw: boolean };
    }) => Promise<{ data: { token: string } | null } | null>;
  };
};

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
 * The session-store subscription drops the query cache when the settled
 * identity flips (anonymous ↔ signed-in). Sign-in must not keep anonymous
 * `baby.listByUser` / `profile.get` results; expiry must not keep a profile
 * that would let the /_auth guard skip its token check. The first settled
 * snapshot is left alone so SSR-hydrated queries survive reload, and a
 * same-identity refresh does not wipe the dashboard.
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
  opts.convexQueryClient.convexClient.setAuth(async () => {
    const result = await opts.authClient.convex
      .token({ fetchOptions: { throw: false } })
      .catch(() => null);
    return result?.data?.token ?? null;
  });

  let lastHasSession: boolean | null = null;

  opts.authClient.$store.atoms.session?.subscribe((session) => {
    if (!session || session.isPending) {
      return;
    }
    const hasSession = session.data != null;
    if (lastHasSession !== null && lastHasSession !== hasSession) {
      opts.queryClient.clear();
    }
    lastHasSession = hasSession;
  });
}

/**
 * Parses better-auth's atom bag. `session` is not assumed present or
 * well-typed at runtime — the real client types `$store.atoms` as
 * `Record<string, WritableAtom>`. Tests pass invalid shapes under
 * `@ts-expect-error`.
 *
 * Do not use `'session' in atoms`: the better-auth client is a Proxy
 * over `function() {}` with no `has` trap, so that check is always
 * false even when property access returns the nanostores atom.
 *
 * @internal Exported for tests.
 */
export function readSessionAtom(atoms: typeof authClient.$store.atoms): SessionAtom | undefined {
  const session = atoms.session;
  if (!isPlainObject(session)) {
    return undefined;
  }
  if (!("subscribe" in session) || !isFunction(session.subscribe)) {
    return undefined;
  }
  const subscribe = session.subscribe;
  return {
    subscribe: (listener) => {
      const unsubscribe = subscribe.call(session, listener);
      if (isFunction(unsubscribe)) {
        return unsubscribe;
      }
      return () => {};
    },
  };
}

/** @internal Exported for tests. */
export function compatibleConvexAuthClient(client: typeof authClient): ConvexAuthClient {
  return {
    $store: {
      atoms: {
        session: readSessionAtom(client.$store.atoms),
      },
    },
    convex: {
      token: (opts) => client.convex.token(opts),
    },
  };
}

export function setupClientConvexAuth(
  convexQueryClient: ConvexQueryClient,
  queryClient: QueryClient,
) {
  // The real client types `$store.atoms` as `Record<string, WritableAtom>`,
  // so it structurally lacks the named `session` property `ConvexAuthClient`
  // declares for tests — narrow it explicitly here.
  setupClientConvexAuthWithClient({
    authClient: compatibleConvexAuthClient(authClient),
    convexQueryClient,
    queryClient,
  });
}
