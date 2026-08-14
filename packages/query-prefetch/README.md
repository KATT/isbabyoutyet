# Query Prefetching

Start TanStack queries in a React Router `clientLoader`, hand the component a tiny
serializable **handle**, and rebuild the exact same query options at the read
site. The result: navigation is never blocked on data you don't need up front,
loader data stays serializable, and the loader and component share one query
factory — so the data type flows end to end with zero duplication.

## TL;DR

```tsx
// 1. A normal TanStack query factory.
const postById = (input: { postId: string }) =>
  queryOptions({
    queryKey: ["posts", "byId", input],
    queryFn: () => fetchPost(input),
  });

// 2. Start it in the loader (fire-and-forget) and return the handle.
export async function clientLoader() {
  const initiator = getQueryInitiator(getQueryClient(), { onError });
  return { post: initiator.ensureQueryData(postById, { postId }) };
}

// 3. Rebuild options from the handle at the read site.
function PostRoute() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const postQuery = useSuspenseQuery(preloadedQueryOptions(postById, loaderData.post));
  return <Post post={postQuery.data} />; // data is inferred from postById
}
```

## Why this pattern

- **Non-blocking by default** — `getQueryInitiator` warms the cache without
  `await`, so the route renders immediately and components suspend only where
  data is actually read.
- **Loader data proves intent** — the returned handles are the route's data
  contract; they show exactly which queries were started or fully awaited.
- **Serializable** — handles store only the factory **input** plus a type-only
  brand, never live query options or functions.
- **One factory, one data type** — the loader and the component call the same
  factory, so the resolved `data`/`error` types are inferred at the read site.
- **Composes with nested routes** — each route keeps its own loader, handles,
  and error boundary.

## Mental model

```
query factory ──(loader)──▶ handle ──(component)──▶ rebuilt query options
  postById         ensureQueryData      preloadedQueryOptions(postById, handle)
```

A **handle** is the only thing that crosses the loader→component boundary:

```ts
interface InitiatedQuery<TFactory> {
  readonly input?: QueryInput<TFactory>; // the factory's single argument
}

interface PreloadedQuery<TFactory> extends InitiatedQuery<TFactory> {
  readonly initialData: QueryDataOf<TFactory>; // present only when awaited
}
```

`preloadedQueryOptions(factory, handle)` rebuilds `factory(handle.input)`. When the
handle is preloaded, the rebuilt options also carry `initialData`, so a
non-suspense `useQuery(...)` infers defined `data`.

> **Factories take 0 or 1 argument.** `QueryOptionsFactory` is typed to reject
> any factory with two or more parameters — the single argument is the query's
> `input`. No-arg factories are fine; pass nothing (or `undefined`).

## Initiating queries (fire-and-forget)

Use `getQueryInitiator(queryClient, { onError })` for cache warming that must not
block navigation. Read the handle with `useSuspenseQuery(...)`.

```tsx
export async function clientLoader() {
  const initiator = getQueryInitiator(getQueryClient(), { onError });
  return {
    post: initiator.ensureQueryData(postById, { postId }),
    settings: initiator.ensureQueryData(accountSettings), // no-arg factory
  };
}

function PostRoute() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const postQuery = useSuspenseQuery(preloadedQueryOptions(postById, loaderData.post));
  return <Post post={postQuery.data} />;
}
```

`onError` receives `{ error }` for any rejected prefetch — wire it to your error
reporter (e.g. `captureError`). Rejected prefetches never throw out of the loader.

## Blocking queries (preloading)

Use `getQueryPreloader(queryClient)` when a later query's input depends on
already-loaded data, or when the route genuinely should not render without the
data. The awaited handle carries `initialData`.

```tsx
export async function clientLoader() {
  const preloader = getQueryPreloader(getQueryClient());

  // Await only what a dependent input needs...
  const user = await preloader.ensureQueryData(currentUser);

  // ...then use initialData purely to build the dependent input.
  return {
    user,
    org: await preloader.ensureQueryData(orgById, { orgId: user.initialData.orgId }),
  };
}

function Route() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const userQuery = useQuery(preloadedQueryOptions(currentUser, loaderData.user));
  return <Profile user={userQuery.data} />; // data is defined via initialData
}
```

Await independent blocking queries together:

```ts
const { post, author } = await allKeyed({
  post: preloader.ensureQueryData(postById, { postId }),
  author: preloader.ensureQueryData(authorByPostId, { postId }),
});
```

Or spread straight into the loader return:

```ts
return await allKeyed({
  post: preloader.ensureQueryData(postById, { postId }),
  author: preloader.ensureQueryData(authorByPostId, { postId }),
});
```

`allKeyed` is a ponyfill of the Stage 3 [`Promise.allKeyed`](https://github.com/tc39/proposal-await-dictionary) proposal — same keys in, same keys out.

Let awaited failures reach the nearest route `ErrorBoundary` — don't catch them
just to keep navigation alive.

## Infinite queries

`ensureInfiniteQueryData` / `preloadedInfiniteQueryOptions` are the
`infiniteQueryOptions(...)` counterparts.

```tsx
export async function clientLoader() {
  const initiator = getQueryInitiator(getQueryClient(), { onError });
  return { posts: initiator.ensureInfiniteQueryData(postsInfinite, { authorId }) };
}

function PostsRoute() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const postsQuery = useSuspenseInfiniteQuery(
    preloadedInfiniteQueryOptions(postsInfinite, loaderData.posts),
  );
  return <Posts pages={postsQuery.data.pages} />;
}
```

## Remixing input at the read site

> [!WARNING]
> **Last resort — prefer URL state.** If the varying input can live in the route
> path or search params, drive it from there: the loader re-runs on navigation
> and prefetches the right variant, no remixing required. Reach for remix **only**
> when the input is held in local component state (`useState`) the URL doesn't
> capture — e.g. a sort or filter toggle inside a modal.

When a query is prefetched with a default input but the component varies one
field from local state, pass an optional third argument to transform the handle's
stored input before the options are rebuilt:

```tsx
const postsInfinite = (input: { authorId: string; sort: "newest" | "oldest" }) =>
  infiniteQueryOptions({ queryKey: ["posts", input] /* ... */ });

function PostList(props: { posts: InitiatedInfiniteQuery<typeof postsInfinite> }) {
  // The sort is a local toggle, so it can't come from the loader. Seed it from
  // the handle's input so the first render matches the prefetched variant.
  const [sort, setSort] = useState(props.posts.input?.sort ?? "newest");

  const postsQuery = useSuspenseInfiniteQuery(
    preloadedInfiniteQueryOptions(postsInfinite, props.posts, (input) => ({ ...input, sort })),
  );
  // ...
}
```

How it behaves:

- Remixing changes the query key, so the read fetches the remixed variant.
- On the **unremixed first render** the key matches the initiated query, so the
  prefetched data is reused with no extra round trip.
- For **preloaded** handles, `initialData` corresponds to the handle's original
  input — only remix a preloaded handle when the first render is the identity
  transform.

## Component-side waterfalls

> [!WARNING]
> **Last resort — prefer prefetching.** A waterfall is a second round trip keyed
> off data only known at render time. First try to read the dependency from the
> route/search params (so the loader can prefetch it), or get the backend to
> return it alongside its dependency. Use a waterfall **only** when the input is
> genuinely unknowable until render.

When a query's input is only known at render time — e.g. an id pulled from a
parent query's result — the loader can't start it. Use `useInitiateQuery` /
`useInitiateInfiniteQuery` to start it during render and get back a handle, so
the rest of the tree consumes it just like a loader handle:

```tsx
function PostRoute(props: { post: InitiatedQuery<typeof postById> }) {
  const postQuery = useSuspenseQuery(preloadedQueryOptions(postById, props.post));
  const { authorId } = postQuery.data; // only known once the post resolves

  // authorId is render-time data, so the loader couldn't have started this.
  const author = useInitiateQuery(authorById, { authorId });
  const authorQuery = useSuspenseQuery(preloadedQueryOptions(authorById, author));
  // ...
}
```

The `Waterfall` name is the warning: reach for it only when the input can't be
known earlier. If it can, initiate the query in the loader instead.

## Producing handles as high as possible

A child that reads a query should receive a **handle**, not fetch for itself —
that keeps it a pure consumer and pushes the fetch as early as possible. Create
the handle at the highest point that knows its input:

1. **In the loader (preferred)** when the input is known from route/search params.
2. **Via a waterfall** in the topmost component that has the input, when it's only
   known at render time (a parent query's result, a dynamically chosen id).

The consumer is identical either way — it reads the handle and remixes any local
state:

```tsx
// Pure consumer: receives the handle, owns only the local sort.
function CommentList(props: { comments: InitiatedInfiniteQuery<typeof commentsInfinite> }) {
  const [sort, setSort] = useState(props.comments.input?.sort ?? "newest");
  const commentsQuery = useSuspenseInfiniteQuery(
    preloadedInfiniteQueryOptions(commentsInfinite, props.comments, (input) => ({
      ...input,
      sort,
    })),
  );
  // ...
}

// Producer A — loader knows the postId from the route, so it prefetches.
export async function clientLoader({ params }) {
  const initiator = getQueryInitiator(getQueryClient(), { onError });
  return {
    comments: initiator.ensureInfiniteQueryData(commentsInfinite, {
      postId: params.postId,
      sort: "newest",
    }),
  };
}
function PostRoute() {
  const loaderData = useLoaderData<typeof clientLoader>();
  return <CommentList comments={loaderData.comments} />;
}

// Producer B — no loader owns this dialog; the postId is only known once a parent
// query resolves, so the handle is created with a waterfall at that point.
function PostPreviewDialog(props: { post: InitiatedQuery<typeof postById> }) {
  const postQuery = useSuspenseQuery(preloadedQueryOptions(postById, props.post));
  const comments = useInitiateInfiniteQuery(commentsInfinite, {
    postId: postQuery.data.id,
    sort: "newest",
  });
  return <CommentList comments={comments} />;
}
```

## API reference

| Export                                                     | Use                                                                                       |
| ---------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `getQueryInitiator(queryClient, { onError })`              | Fire-and-forget cache warming → `InitiatedQuery` / `InitiatedInfiniteQuery` handles       |
| `getQueryPreloader(queryClient)`                           | Awaited prefetch → `PreloadedQuery` / `PreloadedInfiniteQuery` handles with `initialData` |
| `preloadedQueryOptions(factory, handle, remix?)`           | Rebuild query options from a handle; optional `remix` transforms the input                |
| `preloadedInfiniteQueryOptions(factory, handle, remix?)`   | Infinite-query counterpart                                                                |
| `useInitiateQuery(factory, input?)`                        | Start a query during render (render-time input) → handle                                  |
| `useInitiateInfiniteQuery(factory, input?)`                | Infinite-query counterpart                                                                |
| `testInitiatedQuery` / `testPreloadedQuery` / `*Infinite*` | `./test-helpers` builders for typed handles in tests                                      |

Handle types: `InitiatedQuery`, `PreloadedQuery`, `InitiatedInfiniteQuery`,
`PreloadedInfiniteQuery`, plus the `QueryOptionsFactory` constraint.

## Source files

- `src/query-loader.ts` — `getQueryInitiator(...)` and `getQueryPreloader(...)`
- `src/query-options.ts` — `preloadedQueryOptions(...)` and `preloadedInfiniteQueryOptions(...)` (incl. `remix`)
- `src/query-initiate-hooks.ts` — `useInitiateQuery(...)` and `useInitiateInfiniteQuery(...)`
- `src/test-helpers.ts` — typed handle builders (`./test-helpers` entry point)
- `src/types.ts` — branded handle types and the `QueryOptionsFactory` / `QueryInput` helpers
