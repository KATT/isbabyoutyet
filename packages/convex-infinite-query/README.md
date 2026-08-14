# Convex infinite queries for TanStack Query

Bridge between Convex cursor pagination and TanStack
`useSuspenseInfiniteQuery`, including SSR via `ConvexQueryClient` and live
page sync with `watchQuery`.

Pairs with [`@workspace/query-prefetch`](../query-prefetch) handles so loaders
can `ensureInfiniteQueryData` and components read with
`usePreloadedConvexInfiniteQuery`.

## Setup

```ts
import { ConvexQueryClient } from "@convex-dev/react-query";
import {
  convexInfiniteQueryFn,
  registerConvexInfiniteQueryClient,
} from "@workspace/convex-infinite-query";

const convexQueryClient = new ConvexQueryClient(convex);
registerConvexInfiniteQueryClient(convexQueryClient);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: convexInfiniteQueryFn(convexQueryClient),
    },
  },
});
```

## Factory

```ts
import { convexInfiniteQuery } from "@workspace/convex-infinite-query";

export const timelineByBaby = (input: { babyId: Id<"baby"> }) =>
  convexInfiniteQuery(api.timeline.listByBaby, {
    args: input,
    initialNumItems: 20,
  });
```

## Read site

```tsx
const timeline = usePreloadedConvexInfiniteQuery(timelineByBaby, {
  handle: loaderData.timeline,
  remixInput: null,
});

useLiveConvexInfinitePages({
  queryKey: timelineByBaby(input).queryKey,
  funcRef: api.timeline.listByBaby,
  args: input,
  pageParams: timeline.data.pageParams,
});
```
