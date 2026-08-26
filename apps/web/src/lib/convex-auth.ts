import { convexQuery } from "@convex-dev/react-query";
import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient } from "@tanstack/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { authClient } from "./auth-client";

type SessionSnapshot = { data: unknown; isPending: boolean };
type SessionAtom = {
  subscribe: (listener: (session: SessionSnapshot | undefined) => void) => () => void;
};

/** The subset of `authClient` that `setupClientConvexAuth` depends on. */
export type ConvexAuthClient = {
  convex: {
    token: (opts: {
      fetchOptions: { throw: boolean };
    }) => Promise<{ data: { token: string } | null } | null>;
  };
  $store: {
    atoms: {
      session: SessionAtom | undefined;
    };
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
 * The session-store subscription keeps the /_auth guard's session signal
 * honest: when better-auth resolves to "no session" (e.g. expiry noticed on
 * focus — sign-out itself does a full reload), a stale profile must not
 * survive in the query cache and let the guard skip its token check.
 *
 * Takes `authClient` as a dependency (defaulted to the real client by
 * {@link setupClientConvexAuth}) so tests can inject a stub without mocking
 * the `@/lib/auth-client` module — the real client's `convex.token()` is a
 * better-auth proxy method that can't be `vi.spyOn`-ed.
 *
 * @internal Exported for tests.
 */
export function setupClientConvexAuthWithClient(opts: {
  convexQueryClient: ConvexQueryClient;
  queryClient: QueryClient;
  authClient: ConvexAuthClient;
}) {
  opts.convexQueryClient.convexClient.setAuth(async () => {
    const result = await opts.authClient.convex
      .token({ fetchOptions: { throw: false } })
      .catch(() => null);
    return result?.data?.token ?? null;
  });

  opts.authClient.$store.atoms.session?.subscribe((session) => {
    if (session && !session.isPending && !session.data) {
      opts.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, null);
    }
  });
}

function compatibleConvexAuthClient(client: typeof authClient): ConvexAuthClient;
function compatibleConvexAuthClient(client: unknown): unknown {
  return client;
}

export function setupClientConvexAuth(
  convexQueryClient: ConvexQueryClient,
  queryClient: QueryClient,
) {
  // The real client types `$store.atoms` as `Record<string, WritableAtom>`,
  // so it structurally lacks the named `session` property `ConvexAuthClient`
  // declares for tests — narrow it explicitly here.
  setupClientConvexAuthWithClient({
    convexQueryClient,
    queryClient,
    authClient: compatibleConvexAuthClient(authClient),
  });
}
