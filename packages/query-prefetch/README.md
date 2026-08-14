# Query Prefetching

Await TanStack queries in a React Router `clientLoader`, hand the component a
tiny serializable **handle**, and rebuild the exact same query options at the
read site. The result: loader data stays serializable, revisits are free via
the query cache, and the loader and component share one query factory — so the
data type flows end to end with zero duplication.

## TL;DR

```tsx
// 1. A normal TanStack query factory.
const postById = (input: { postId: string }) =>
  queryOptions({
    queryKey: ["posts", "byId", input],
    queryFn: () => fetchPost(input),
  });

// 2. Await it in the loader and return the handle.
export async function clientLoader() {
  const preloader = getQueryPreloader(getQueryClient());
  return { post: await preloader.ensureQueryData(postById, { postId }) };
}

// 3. Rebuild options from the handle at the read site.
function PostRoute() {
  const loaderData = useLoaderData<typeof clientLoader>();
  const postQuery = useSuspenseQuery(preloadedQueryOptions(postById, loaderData.post));
  return <Post post={postQuery.data} />; // data is inferred from postById
}
```

## Why this pattern

- **Loader data proves intent** — the returned handles are the route's data
  contract; they show exactly which queries the route depends on.
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
interface PreloadedQuery<TFactory> {
  readonly input?: QueryInput<TFactory>; // the factory's single argument
  readonly initialData: QueryDataOf<TFactory>; // the awaited loader result
}
```

`preloadedQueryOptions(factory, handle)` rebuilds `factory(handle.input)` with the
handle's `initialData` attached, so a non-suspense `useQuery(...)` infers
defined `data`.

> **Factories take 0 or 1 argument.** `QueryOptionsFactory` is typed to reject
> any factory with two or more parameters — the single argument is the query's
> `input`. No-arg factories are fine; pass nothing (or `undefined`).

## Preloading queries

Use `getQueryPreloader(queryClient)` to await queries in the loader. The
awaited handle carries `initialData`, and the query cache keeps repeat
navigations free.

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
  const preloader = getQueryPreloader(getQueryClient());
  return { posts: await preloader.ensureInfiniteQueryData(postsInfinite, { authorId }) };
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

function PostList(props: { posts: PreloadedInfiniteQuery<typeof postsInfinite> }) {
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
- On the **unremixed first render** the key matches the preloaded query, so the
  loader data is reused with no extra round trip.
- `initialData` corresponds to the handle's original input — only remix a
  handle when the first render is the identity transform.

## Component-side waterfalls

> [!WARNING]
> **Last resort — prefer prefetching.** A waterfall is a second round trip keyed
> off data only known at render time. First try to read the dependency from the
> route/search params (so the loader can prefetch it), or get the backend to
> return it alongside its dependency.

When a query's input is only known at render time — e.g. an id pulled from a
parent query's result — the loader can't start it. Suspend on the query
directly instead of going through a handle:

```tsx
function PostRoute(props: { post: PreloadedQuery<typeof postById> }) {
  const postQuery = useSuspenseQuery(preloadedQueryOptions(postById, props.post));
  const { authorId } = postQuery.data; // only known once the post resolves

  // authorId is render-time data, so the loader couldn't have started this.
  const authorQuery = useSuspenseQuery(authorById({ authorId }));
  // ...
}
```

## Producing handles as high as possible

A child that reads a query should receive a **handle**, not fetch for itself —
that keeps it a pure consumer and pushes the fetch as early as possible. Create
the handle in the loader, which knows the input from the route/search params:

```tsx
// Pure consumer: receives the handle, owns only the local sort.
function CommentList(props: { comments: PreloadedInfiniteQuery<typeof commentsInfinite> }) {
  const [sort, setSort] = useState(props.comments.input?.sort ?? "newest");
  const commentsQuery = useSuspenseInfiniteQuery(
    preloadedInfiniteQueryOptions(commentsInfinite, props.comments, (input) => ({
      ...input,
      sort,
    })),
  );
  // ...
}

// Producer — the loader knows the postId from the route, so it preloads.
export async function clientLoader({ params }) {
  const preloader = getQueryPreloader(getQueryClient());
  return {
    comments: await preloader.ensureInfiniteQueryData(commentsInfinite, {
      postId: params.postId,
      sort: "newest",
    }),
  };
}
function PostRoute() {
  const loaderData = useLoaderData<typeof clientLoader>();
  return <CommentList comments={loaderData.comments} />;
}
```

## API reference

| Export                                                   | Use                                                                                       |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `getQueryPreloader(queryClient)`                         | Awaited prefetch → `PreloadedQuery` / `PreloadedInfiniteQuery` handles with `initialData` |
| `preloadedQueryOptions(factory, handle, remix?)`         | Rebuild query options from a handle; optional `remix` transforms the input                |
| `preloadedInfiniteQueryOptions(factory, handle, remix?)` | Infinite-query counterpart                                                                |
| `allKeyed(promises)`                                     | Await an object of promises, preserving keys                                              |
| `testPreloadedQuery` / `testPreloadedInfiniteQuery`      | `./test-helpers` builders for typed handles in tests                                      |

Handle types: `PreloadedQuery`, `PreloadedInfiniteQuery`, plus the
`QueryOptionsFactory` constraint.

## Source files

- `src/query-loader.ts` — `getQueryPreloader(...)`
- `src/query-options.ts` — `preloadedQueryOptions(...)` and `preloadedInfiniteQueryOptions(...)` (incl. `remix`)
- `src/test-helpers.ts` — typed handle builders (`./test-helpers` entry point)
- `src/types.ts` — branded handle types and the `QueryOptionsFactory` / `QueryInput` helpers
