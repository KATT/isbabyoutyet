import { queryOptions, skipToken } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { InitiatedQuery } from "@workspace/query-prefetch";
import { getQueryInitiator } from "@workspace/query-prefetch";
import { agentDebugLog } from "@/lib/agent-debug";

const browserImagePrefetchQueryKey = ["browserImagePrefetch"] as const;

function browserImageQueryOptions(imageUrl: string) {
  return queryOptions({
    queryKey: [...browserImagePrefetchQueryKey, imageUrl],
    queryFn: typeof window !== "undefined" ? () => loadBrowserImage(imageUrl) : skipToken,
  });
}

export function browserImageFactory(imageUrl: string) {
  return browserImageQueryOptions(imageUrl);
}

export type BrowserImageFactory = typeof browserImageFactory;

/**
 * Fire-and-forget image warm in route loaders. On the server returns a
 * serializable handle without touching `Image` / the network.
 */
export function prefetchBrowserImage(
  queryClient: QueryClient,
  imageUrl: string,
): InitiatedQuery<BrowserImageFactory> {
  if (typeof window === "undefined") {
    return { input: imageUrl } as InitiatedQuery<BrowserImageFactory>;
  }
  const options = browserImageQueryOptions(imageUrl);
  const state = queryClient.getQueryState(options.queryKey);
  // #region agent log
  agentDebugLog({
    hypothesisId: "C,E",
    location: "image-prefetch.ts:prefetch-request",
    message: "Browser image prefetch requested",
    data: {
      cacheStatus: state?.status ?? "missing",
      fetchStatus: state?.fetchStatus ?? "idle",
    },
  });
  // #endregion
  return getQueryInitiator(queryClient).ensureQueryData(browserImageFactory, imageUrl);
}

/**
 * Starts the same cached browser warm as {@link prefetchBrowserImage}, then
 * waits for it before allowing client navigation to finish. SSR still returns
 * the serializable handle immediately without touching `Image`.
 */
export async function waitForBrowserImage(
  queryClient: QueryClient,
  imageUrl: string,
): Promise<InitiatedQuery<BrowserImageFactory>> {
  const imagePrefetch = prefetchBrowserImage(queryClient, imageUrl);
  if (typeof window !== "undefined") {
    await queryClient.ensureQueryData(browserImageQueryOptions(imageUrl));
  }
  return imagePrefetch;
}

function loadBrowserImage(imageUrl: string) {
  return new Promise<{ url: string; ok: boolean }>((resolve) => {
    const startedAt = Date.now();
    // #region agent log
    agentDebugLog({
      hypothesisId: "B,D,E",
      location: "image-prefetch.ts:load-start",
      message: "Browser image warm started",
      data: { priorResourceEntries: performance.getEntriesByName(imageUrl).length },
    });
    // #endregion
    const image = new Image();
    const finish = (ok: boolean) => {
      const entries = performance.getEntriesByName(imageUrl);
      const resource = entries.at(-1) as PerformanceResourceTiming | undefined;
      // #region agent log
      agentDebugLog({
        hypothesisId: "B,D,E",
        location: "image-prefetch.ts:load-finish",
        message: "Browser image warm finished",
        data: {
          elapsedMs: Date.now() - startedAt,
          ok,
          resourceEntries: entries.length,
          transferSize: resource?.transferSize ?? null,
        },
      });
      // #endregion
      resolve({ url: imageUrl, ok });
    };
    image.onload = () => finish(true);
    // Soft-fail: image callers still render their normal broken-image state.
    image.onerror = () => finish(false);
    image.src = imageUrl;
  });
}
