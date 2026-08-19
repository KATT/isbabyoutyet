# Convex prefetch — funcRef-first loader handles for TanStack Query

SSR/loader prefetching for Convex on TanStack Query where **the Convex
function reference is the interface** — no per-query factory registry.

Plain queries ride on `convexQuery` from `@convex-dev/react-query`; paginated
queries get cursor-paged infinite queries with SSR and live `watchQuery` page
sync.

## Setup (router)

```ts
import { ConvexQueryClient } from "@convex-dev/react-query";
import {
  convexInfiniteQueryFn,
  registerConvexInfiniteQueryClient,
} from "@workspace/convex-prefetch";

const convexQueryClient = new ConvexQueryClient(convexUrl);
registerConvexInfiniteQueryClient(convexQueryClient);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryKeyHashFn: convexQueryClient.hashFn(),
      queryFn: convexInfiniteQueryFn(convexQueryClient),
    },
  },
});
```

## Loader

```ts
import { allKeyed } from "@workspace/query-prefetch";

loader: async (opts) => {
  const preloader = opts.context.convexPreloader;
  return await allKeyed({
    profile: preloader.ensureQueryData(api.profile.get, {}),
    timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
      args: { babyId },
      numItems: 20,
    }),
  });
};
```

`convexPreloader` is created once in `getRouter()` via `getConvexQueryPreloader(queryClient)` and passed on router context.

## Read site

```tsx
const profileQuery = usePreloadedConvexQuery(api.profile.get, loaderData.profile);

const timelineQuery = usePreloadedConvexInfiniteQuery(api.timeline.listByBaby, {
  handle: loaderData.timeline,
  // remix args held in local state the URL doesn't capture; identity on first render
  remixArgs: (args) => ({ ...args, visitorId }),
});
const items = timelineQuery.data.pages.flatMap((page) => page.page);
```

`usePreloadedConvexInfiniteQuery` subscribes every loaded page to Convex
`watchQuery`, so pages stay live without extra wiring.

## Client-only inputs

When browser-only state must be combined with Convex (e.g. push endpoint +
`isSubscribed`), resolve both in one TanStack query factory and prefetch it from
the route loader on the client. See `browserPushQueryOptions(queryClient, babyRef)` in
`notification-subscribe.tsx` — the loader calls `prefetchBrowserPushCapability`
without blocking SSR.

## Testing

`@workspace/convex-prefetch/test-helpers` exports
`testPreloadedConvexQuery` / `testPreloadedConvexInfiniteQuery` to build typed
handles for component tests.
