# Loader waterfall examples

## ❌ Waterfall: resolve id, then prefetch dependents

```typescript
beforeLoad: async (opts) => {
  const baby = await preloader.ensureQueryData(api.baby.getByPublicId, {
    id: opts.params.publicId,
  });
  if (!baby.initialData) throw notFound();
  return { babyId: baby.initialData._id };
},

loader: async (opts) => {
  const babyId = opts.context.babyId; // loader blocked on beforeLoad
  return await allKeyed({
    baby: preloader.ensureQueryData(api.baby.getByPublicId, { id: opts.params.publicId }),
    timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
      args: { babyId }, // cannot start until beforeLoad finishes
      numItems: 20,
    }),
  });
};
```

Problems: `beforeLoad` → `loader` serializes; timeline prefetch waits on baby resolution even though the URL slug is enough.

## ✅ Parallel: slug everywhere

```typescript
beforeLoad: async (opts) => {
  // routing only: 404, redirect stale slug, locale
  const baby = await preloader.ensureQueryData(api.baby.getByPublicId, {
    id: opts.params.publicId,
  });
  if (!baby.initialData) throw notFound();
  if (baby.initialData.publicId !== opts.params.publicId) {
    throw redirect({ to: "/baby/$publicId", params: { publicId: baby.initialData.publicId } });
  }
  return { locale: baby.initialData.resolvedLocale };
},

loader: async (opts) => {
  const publicId = opts.params.publicId;
  return await allKeyed({
    baby: preloader.ensureQueryData(api.baby.getByPublicId, { id: publicId }),
    timeline: preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
      args: { babyId: publicId },
      numItems: 20,
    }),
    myAccess: preloader.ensureQueryData(api.coParents.myAccess, { babyId: publicId }),
  });
};
```

Backend queries accept `v.union(v.id("baby"), v.string())` and resolve internally.

## ❌ Waterfall: auth setup in page loader

```typescript
loader: async (opts) => {
  const token = await getAuthToken(opts);
  opts.context.convexClient.setAuth(token);
  await opts.context.convexClient.mutation(api.profile.ensure, {});
  return await allKeyed({ /* … */ });
};
```

Auth belongs on root SSR / layout; public pages should not block on profile side effects.

## ❌ Sequential awaits inside loader

```typescript
loader: async (opts) => {
  const baby = await preloader.ensureQueryData(api.baby.getByPublicId, { id: publicId });
  const timeline = await preloader.ensureInfiniteQueryData(api.timeline.listByBaby, {
    args: { babyId: baby.initialData._id },
    numItems: 20,
  });
  return { baby, timeline };
};
```

Use `allKeyed` instead.

## ✅ Client-only: non-blocking initiated handle

```typescript
loader: async (opts) => {
  const browserPush = prefetchBrowserPushCapability(opts.context.queryClient);
  const data = await allKeyed({ /* convex only */ });
  return { browserPush, ...data };
};
```

`browserPush` returns immediately on the server; the component reads it via `useQuery(preloadedQueryOptions(...))`.
