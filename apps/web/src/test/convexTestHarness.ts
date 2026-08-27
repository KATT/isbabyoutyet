import type { ConvexQueryClient } from "@convex-dev/react-query";
import type { QueryClient, QueryFunctionContext } from "@tanstack/react-query";
import { QueryClient as QueryClientImpl } from "@tanstack/react-query";
import { convexTest } from "convex-test";
import { makeFunctionReference } from "convex/server";
import type { FunctionReference, UserIdentity } from "convex/server";
import type { Value } from "convex/values";
import {
  CONVEX_INFINITE_QUERY_KEY,
  convexInfiniteQueryFn,
  getConvexQueryPreloader,
  registerConvexInfiniteQueryClient,
} from "@workspace/convex-prefetch";
import schema from "@workspace/convex/convex/schema";
import { makeAsyncResource } from "@workspace/convex/convex/test.resource";
import { modules, registerComponents } from "@workspace/convex/convex/test.setup";

type ConvexTestRoot = ReturnType<typeof convexTest>;
type ConvexTestCaller = ConvexTestRoot | ReturnType<ConvexTestRoot["withIdentity"]>;

type WatchQueryHandle = {
  localQueryResult: () => Value | undefined;
  onUpdate: (cb: () => void) => void;
};

type ConvexQueryRef = FunctionReference<"query">;
type ConvexMutationRef = FunctionReference<"mutation">;
type ConvexActionRef = FunctionReference<"action">;
type ConvexAuthTokenFetcher = () => Promise<string | null | undefined>;

type ConvexCallerQuery = <TArgs>(query: ConvexQueryRef, args: TArgs) => Promise<Value>;
type ConvexCallerMutation = <TArgs>(mutation: ConvexMutationRef, args: TArgs) => Promise<Value>;
type ConvexCallerAction = <TArgs>(action: ConvexActionRef, args: TArgs) => Promise<Value>;

export type IntegrationConvexClient = {
  query: ConvexCallerQuery;
  mutation: ConvexCallerMutation;
  action: ConvexCallerAction;
  watchQuery: <TArgs>(query: ConvexQueryRef, args: TArgs) => WatchQueryHandle;
  setAuth: (fetchToken: ConvexAuthTokenFetcher, onChange: (authenticated: boolean) => void) => void;
  clearAuth: () => void;
};

export type ConvexTestHarness = {
  t: ConvexTestRoot;
  client: ConvexTestCaller;
  queryClient: QueryClient;
  convexPreloader: ReturnType<typeof getConvexQueryPreloader>;
  convexQueryClient: ConvexQueryClient;
  convexClient: IntegrationConvexClient;
  /** Switch the active caller on the shared in-memory backend. */
  withIdentity: (identity: Partial<UserIdentity> | null) => ConvexTestHarness;
};

/**
 * Boots a shared in-memory Convex backend (`convex-test`) and wires it into the
 * same React Query + prefetch stack production uses — no `vi.mock("convex/*")`,
 * no hand-built query results.
 */
export async function createConvexTestHarness(opts: { identity: Partial<UserIdentity> | null }) {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  let activeClient: ConvexTestCaller = opts.identity ? t.withIdentity(opts.identity) : t;

  const watchCache = new Map<object, Map<string, Value>>();
  let queryClientForInvalidation: QueryClient | null = null;

  function runQuery<TArgs>(query: ConvexQueryRef, args: TArgs) {
    return (activeClient.query as ConvexCallerQuery)(query, args);
  }

  function runMutation<TArgs>(mutation: ConvexMutationRef, args: TArgs) {
    return (activeClient.mutation as ConvexCallerMutation)(mutation, args);
  }

  function runAction<TArgs>(action: ConvexActionRef, args: TArgs) {
    return (activeClient.action as ConvexCallerAction)(action, args);
  }

  function invalidateConvexQueries() {
    if (!queryClientForInvalidation) {
      return;
    }
    void queryClientForInvalidation.invalidateQueries({ queryKey: ["convexQuery"] });
    void queryClientForInvalidation.invalidateQueries({ queryKey: [CONVEX_INFINITE_QUERY_KEY] });
    for (const queryCache of watchCache.values()) {
      queryCache.clear();
    }
  }

  const convexClient: IntegrationConvexClient = {
    query: runQuery,
    mutation: async (mutation, args) => {
      const result = await runMutation(mutation, args);
      invalidateConvexQueries();
      return result;
    },
    action: async (action, args) => {
      const result = await runAction(action, args);
      invalidateConvexQueries();
      return result;
    },
    watchQuery: (query, args) => {
      let queryCache = watchCache.get(query as object);
      if (!queryCache) {
        queryCache = new Map<string, Value>();
        watchCache.set(query as object, queryCache);
      }
      const argsKey = JSON.stringify(args ?? {});
      let subscriber: (() => void) | null = null;
      void runQuery(query, args ?? {}).then((result) => {
        queryCache.set(argsKey, result);
        subscriber?.();
      });
      return {
        localQueryResult: () => queryCache.get(argsKey),
        onUpdate: (cb) => {
          subscriber = cb;
          return () => {
            subscriber = null;
          };
        },
      };
    },
    setAuth: (_fetchToken, onChange) => {
      onChange(opts.identity !== null);
    },
    clearAuth: () => {},
  };

  const convexQueryClient = {
    convexClient,
    hashFn: () => JSON.stringify,
    queryFn: () => Promise.resolve(null),
    connect: (nextQueryClient: QueryClient) => {
      queryClientForInvalidation = nextQueryClient;
    },
    serverHttpClient: undefined,
  } as unknown as ConvexQueryClient;

  registerConvexInfiniteQueryClient(convexQueryClient);

  const queryClient = new QueryClientImpl({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: Infinity,
        staleTime: 0,
        queryFn: createIntegrationQueryFn(() => activeClient, convexQueryClient),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const harness: ConvexTestHarness = {
    get t() {
      return t;
    },
    get client() {
      return activeClient;
    },
    queryClient,
    convexPreloader: getConvexQueryPreloader(queryClient),
    convexQueryClient,
    convexClient,
    withIdentity(identity) {
      activeClient = identity ? t.withIdentity(identity) : t;
      invalidateConvexQueries();
      return harness;
    },
  };

  return makeAsyncResource(harness, async () => {
    registerConvexInfiniteQueryClient(null as never);
    queryClient.clear();
  });
}

function createIntegrationQueryFn(
  getClient: () => ConvexTestCaller,
  convexQueryClient: ConvexQueryClient,
) {
  const infiniteQueryFn = convexInfiniteQueryFn(convexQueryClient);

  return async (context: QueryFunctionContext) => {
    const tag = context.queryKey[0];
    const funcName = context.queryKey[1];
    const caller = getClient();
    if (tag === "convexQuery" && typeof funcName === "string") {
      const args = context.queryKey[2] ?? {};
      return await (caller.query as ConvexCallerQuery)(
        makeFunctionReference<"query">(funcName),
        args,
      );
    }
    if (tag === "convexAction" && typeof funcName === "string") {
      const args = context.queryKey[2] ?? {};
      return await (caller.action as ConvexCallerAction)(
        makeFunctionReference<"action">(funcName),
        args,
      );
    }
    if (tag === CONVEX_INFINITE_QUERY_KEY) {
      return await infiniteQueryFn(context as Parameters<typeof infiniteQueryFn>[0]);
    }
    return undefined;
  };
}
