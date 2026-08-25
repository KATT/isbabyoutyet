import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import type { ConvexAuthClient } from "@/lib/convex-auth";
import { setupClientConvexAuthWithClient } from "@/lib/convex-auth";

type SessionSnapshot = { data: unknown; isPending: boolean };
type SessionListener = (session: SessionSnapshot | undefined) => void;

const profileKey = convexQuery(api.profile.get, {}).queryKey;

function makeAuthClient() {
  const listeners: SessionListener[] = [];
  const token = vi.fn<
    (opts: {
      fetchOptions: { throw: boolean };
    }) => Promise<{ data: { token: string } | null } | null>
  >();
  const authClient: ConvexAuthClient = {
    convex: { token },
    $store: {
      atoms: {
        session: {
          subscribe: (listener: SessionListener) => {
            listeners.push(listener);
            return () => {};
          },
        },
      },
    },
  };
  const emit = (session: SessionSnapshot) => {
    for (const listener of listeners) {
      listener(session);
    }
  };
  return { authClient, token, emit };
}

function makeClients() {
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const convexQueryClient = { convexClient: { setAuth } };
  const queryClient = new QueryClient();
  return { setAuth, convexQueryClient, queryClient };
}

test("setup establishes auth immediately: token for signed-in, null for anonymous", async () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    convexQueryClient: clients.convexQueryClient as never,
    queryClient: clients.queryClient,
    authClient: auth.authClient,
  });

  expect(clients.setAuth).toHaveBeenCalledTimes(1);
  const fetchToken = clients.setAuth.mock.calls[0]?.[0];
  if (!fetchToken) {
    throw new Error("expected a token fetcher");
  }

  auth.token.mockResolvedValueOnce({ data: { token: "jwt" } });
  expect(await fetchToken()).toBe("jwt");

  // Anonymous: the token endpoint has no session — resolve as unauthenticated
  // instead of hanging the expectAuth-paused socket.
  auth.token.mockResolvedValueOnce({ data: null });
  expect(await fetchToken()).toBeNull();

  // Endpoint failures must not throw out of the fetcher either.
  auth.token.mockRejectedValueOnce(new Error("token endpoint down"));
  expect(await fetchToken()).toBeNull();
});

test("setup tolerates a missing session atom", () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  auth.authClient.$store.atoms.session = undefined;

  setupClientConvexAuthWithClient({
    convexQueryClient: clients.convexQueryClient as never,
    queryClient: clients.queryClient,
    authClient: auth.authClient,
  });

  expect(clients.setAuth).toHaveBeenCalledTimes(1);
});

test("a session resolving to none clears the cached profile; pending or signed-in leaves it", () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    convexQueryClient: clients.convexQueryClient as never,
    queryClient: clients.queryClient,
    authClient: auth.authClient,
  });
  clients.queryClient.setQueryData(profileKey, {
    locale: "sv",
    timeZone: "Europe/London",
    isAdmin: false,
  });

  auth.emit({ data: null, isPending: true });
  expect(clients.queryClient.getQueryData(profileKey)).not.toBeNull();

  auth.emit({ data: { session: { id: "s1" } }, isPending: false });
  expect(clients.queryClient.getQueryData(profileKey)).not.toBeNull();

  // Session expired (noticed by the store): the /_auth guard's session
  // signal must go null so the next navigation re-checks the token.
  auth.emit({ data: null, isPending: false });
  expect(clients.queryClient.getQueryData(profileKey)).toBeNull();
});
