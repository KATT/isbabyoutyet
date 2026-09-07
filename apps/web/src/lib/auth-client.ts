import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { hashKey, QueryObserver } from "@tanstack/react-query";
import { createAuthClient } from "better-auth/react";
import { convexClient } from "@convex-dev/better-auth/client/plugins";
import type { FunctionReturnType } from "convex/server";
import type { ConvexReactClient } from "convex/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { isValidTimeZone, TIME_ZONE_HINT_HEADER } from "@workspace/convex/src/timeZone";
import { parseVisitorIdHint, VISITOR_ID_HINT_HEADER } from "@workspace/convex/src/visitorId";
import { peekVisitorId } from "@/lib/use-visitor-id";

function browserTimeZone() {
  try {
    const timeZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    return timeZone && isValidTimeZone(timeZone) ? timeZone : null;
  } catch {
    return null;
  }
}

export function getBrowserAuthHeaders() {
  const headers: Record<string, string> = {};
  if (globalThis.window === undefined) {
    return headers;
  }
  const timeZone = browserTimeZone();
  const visitorId = parseVisitorIdHint(peekVisitorId());
  if (timeZone) {
    headers[TIME_ZONE_HINT_HEADER] = timeZone;
  }
  if (visitorId) {
    headers[VISITOR_ID_HINT_HEADER] = visitorId;
  }
  return headers;
}

export const authClient = createAuthClient({
  baseURL: import.meta.env.VITE_SITE_URL,
  plugins: [convexClient()],
});

export function setClientToken(convexReactClient: ConvexReactClient, token: string | null) {
  let nextToken = token;
  convexReactClient.setAuth(async (opts) => {
    if (!opts.forceRefreshToken && nextToken) {
      return nextToken;
    }
    const result = await authClient.convex
      .token({ fetchOptions: { throw: false } })
      .catch(() => null);

    nextToken = result?.data?.token ?? null;
    return nextToken;
  });
}

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

/** @internal So a stuck websocket cannot pin the submit button forever. */
export const SETTLED_ME_WAIT_MS = 10_000;

/**
 * Starts a live `profile.get` observer (call this *before* sign-in / sign-up /
 * sign-out) and resolves once the result matches `opts.presence`.
 *
 * On a matching snapshot the query cache is cleared except `profile.get`.
 */
export function waitForMe(opts: {
  convexQueryClient: Pick<ConvexQueryClient, "queryOptions">;
  presence: MePresence;
  queryClient: QueryClient;
}) {
  const signal = AbortSignal.timeout(SETTLED_ME_WAIT_MS);
  if (signal.aborted) {
    return Promise.resolve();
  }

  const meQuery = opts.convexQueryClient.queryOptions(api.profile.get, {});
  const observer = new QueryObserver(opts.queryClient, meQuery);
  const stop = new AbortController();
  const combined = AbortSignal.any([signal, stop.signal]);
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
    combined.addEventListener("abort", onAbort, { once: true });
    if (combined.aborted) {
      onAbort();
    }
  });
}
