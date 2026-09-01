import { QueryClient } from "@tanstack/react-query";
import { convexQuery } from "@convex-dev/react-query";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import type { ConvexAuthClient } from "@/lib/convex-auth";
import {
  compatibleConvexAuthClient,
  readSessionAtom,
  setupClientConvexAuthWithClient,
} from "@/lib/convex-auth";
import { authClient as realAuthClient } from "@/lib/auth-client";

type SessionSnapshot = { data: unknown; isPending: boolean };
type SessionListener = (session: SessionSnapshot | undefined) => void;

const profileKey = convexQuery(api.profile.get, {}).queryKey;
const babyListKey = convexQuery(api.baby.listByUser, {}).queryKey;

function makeAuthClient() {
  const listeners: Array<SessionListener> = [];
  const token =
    vi.fn<
      (opts: {
        fetchOptions: { throw: boolean };
      }) => Promise<{ data: { token: string } | null } | null>
    >();
  const authClient: ConvexAuthClient = {
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
    convex: { token },
  };
  const emit = (session: SessionSnapshot) => {
    for (const listener of listeners) {
      listener(session);
    }
  };
  return { authClient, emit, token };
}

function makeClients() {
  const setAuth = vi.fn<(fetchToken: () => Promise<string | null>) => void>();
  const convexQueryClient = { convexClient: { setAuth } };
  const queryClient = new QueryClient();
  return { convexQueryClient, queryClient, setAuth };
}

test("setup establishes auth immediately: token for signed-in, null for anonymous", async () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth
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
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });

  expect(clients.setAuth).toHaveBeenCalledTimes(1);
});

function seedCachedQueries(queryClient: QueryClient) {
  queryClient.setQueryData(profileKey, {
    isAdmin: false,
    locale: "sv",
    timeZone: "Europe/London",
  });
  queryClient.setQueryData(babyListKey, []);
}

test("pending and the first settled session leave the query cache (SSR / reload)", () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });
  seedCachedQueries(clients.queryClient);

  auth.emit({ data: null, isPending: true });
  expect(clients.queryClient.getQueryData(profileKey)).not.toBeNull();
  expect(clients.queryClient.getQueryData(babyListKey)).toEqual([]);

  auth.emit({ data: { session: { id: "s1" } }, isPending: false });
  expect(clients.queryClient.getQueryData(profileKey)).not.toBeNull();

  auth.emit({ data: { session: { id: "s1" } }, isPending: false });
  expect(clients.queryClient.getQueryData(babyListKey)).toEqual([]);
});

test("a settled sign-out after a signed-in session clears the query cache", () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });
  seedCachedQueries(clients.queryClient);

  auth.emit({ data: { session: { id: "s1" } }, isPending: false });
  seedCachedQueries(clients.queryClient);

  auth.emit({ data: null, isPending: false });
  expect(clients.queryClient.getQueryData(profileKey)).toBeUndefined();
  expect(clients.queryClient.getQueryData(babyListKey)).toBeUndefined();
});

test("a settled sign-in after an anonymous session clears the query cache", () => {
  const clients = makeClients();
  const auth = makeAuthClient();
  setupClientConvexAuthWithClient({
    authClient: auth.authClient,
    // @ts-expect-error — stand-in only implements setAuth
    convexQueryClient: clients.convexQueryClient,
    queryClient: clients.queryClient,
  });
  seedCachedQueries(clients.queryClient);

  auth.emit({ data: null, isPending: false });
  expect(clients.queryClient.getQueryData(babyListKey)).toEqual([]);

  auth.emit({ data: { session: { id: "s1" } }, isPending: false });
  expect(clients.queryClient.getQueryData(profileKey)).toBeUndefined();
  expect(clients.queryClient.getQueryData(babyListKey)).toBeUndefined();
});

test("readSessionAtom accepts session atoms and rejects invalid shapes", () => {
  // Empty bag is a valid `Record<string, WritableAtom>`; runtime still rejects it.
  expect(readSessionAtom({})).toBeUndefined();
  // @ts-expect-error — session must be a WritableAtom, not null
  expect(readSessionAtom({ session: null })).toBeUndefined();
  // @ts-expect-error — session must be a WritableAtom, not a string
  expect(readSessionAtom({ session: "x" })).toBeUndefined();
  // @ts-expect-error — subscribe must be a function
  expect(readSessionAtom({ session: { subscribe: 1 } })).toBeUndefined();

  const unsub = vi.fn();
  function subscribeWithUnsub(listener: SessionListener) {
    listener({ data: null, isPending: false });
    return unsub;
  }
  // @ts-expect-error — fixture only implements subscribe
  const atom = readSessionAtom({ session: { subscribe: subscribeWithUnsub } });
  expect(atom).toBeTruthy();
  const stop = atom?.subscribe(() => {});
  stop?.();
  expect(unsub).toHaveBeenCalledTimes(1);

  // @ts-expect-error — subscribe must return an unsubscribe function
  const atomWithoutUnsub = readSessionAtom({ session: { subscribe: () => undefined } });
  expect(atomWithoutUnsub?.subscribe(() => {})).toBeTypeOf("function");
});

test("compatibleConvexAuthClient bridges token and session", () => {
  const bridged = compatibleConvexAuthClient(realAuthClient);
  expect(bridged.convex.token).toBeTypeOf("function");
  expect("session" in bridged.$store.atoms).toBe(true);
});
