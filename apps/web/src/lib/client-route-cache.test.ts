import { expect, test, vi } from "vitest";
import type { ConvexReactClient } from "convex/react";

async function importFresh() {
  vi.resetModules();
  return await import("@/lib/client-route-cache");
}

function makeStubClient(opts: { localResult: unknown; fetchResult: unknown }) {
  const onUpdate = vi.fn<() => () => void>(() => () => {});
  const watchQuery = vi.fn(() => ({
    localQueryResult: () => opts.localResult,
    onUpdate,
  }));
  const query = vi.fn<() => Promise<unknown>>(() => Promise.resolve(opts.fetchResult));
  const convexClient = { watchQuery, query } as unknown as ConvexReactClient;
  return { convexClient, watchQuery, query, onUpdate };
}

test("profile: falls back to a network fetch until the subscription is warm", async () => {
  const cache = await importFresh();
  const stub = makeStubClient({
    localResult: undefined,
    fetchResult: { locale: "sv", isAdmin: false },
  });

  const profile = await cache.getClientProfile(stub.convexClient);

  expect(profile).toEqual({ locale: "sv", isAdmin: false });
  expect(stub.query).toHaveBeenCalledTimes(1);
});

test("profile: returns the warm local result without any fetch", async () => {
  const cache = await importFresh();
  const stub = makeStubClient({
    localResult: { locale: "en-GB", isAdmin: true },
    fetchResult: null,
  });

  const profile = await cache.getClientProfile(stub.convexClient);

  expect(profile).toEqual({ locale: "en-GB", isAdmin: true });
  expect(stub.query).not.toHaveBeenCalled();
});

test("profile: a cached null (logged out) is returned as-is without a fetch", async () => {
  const cache = await importFresh();
  const stub = makeStubClient({ localResult: null, fetchResult: { locale: "es", isAdmin: false } });

  const profile = await cache.getClientProfile(stub.convexClient);

  expect(profile).toBeNull();
  expect(stub.query).not.toHaveBeenCalled();
});

test("profile: the subscription is held exactly once across navigations", async () => {
  const cache = await importFresh();
  const stub = makeStubClient({ localResult: { locale: "sv", isAdmin: false }, fetchResult: null });

  await cache.getClientProfile(stub.convexClient);
  await cache.getClientProfile(stub.convexClient);

  expect(stub.onUpdate).toHaveBeenCalledTimes(1);
});

test("baby: warm revisits skip the network, distinct pages hold their own subscriptions", async () => {
  const cache = await importFresh();
  const warm = makeStubClient({ localResult: { publicId: "baby-born" }, fetchResult: null });

  const baby = await cache.getClientBabyByPublicId(warm.convexClient, "baby-born");
  await cache.getClientBabyByPublicId(warm.convexClient, "baby-born");

  expect(baby).toEqual({ publicId: "baby-born" });
  expect(warm.query).not.toHaveBeenCalled();
  expect(warm.onUpdate).toHaveBeenCalledTimes(1);

  // A different publicId is a different cache key: it holds a new
  // subscription and fetches while cold.
  const cold = makeStubClient({
    localResult: undefined,
    fetchResult: { publicId: "baby-waiting" },
  });
  const otherBaby = await cache.getClientBabyByPublicId(cold.convexClient, "baby-waiting");

  expect(otherBaby).toEqual({ publicId: "baby-waiting" });
  expect(cold.query).toHaveBeenCalledTimes(1);
  expect(cold.onUpdate).toHaveBeenCalledTimes(1);
});
