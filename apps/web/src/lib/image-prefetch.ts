import { queryOptions, skipToken } from "@tanstack/react-query";
import type { QueryClient } from "@tanstack/react-query";
import type { InitiatedQuery } from "@workspace/query-prefetch";
import { getQueryInitiator } from "@workspace/query-prefetch";

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
  return getQueryInitiator(queryClient).ensureQueryData(browserImageFactory, imageUrl);
}

function loadBrowserImage(imageUrl: string) {
  return new Promise<{ url: string; ok: boolean }>((resolve) => {
    const image = new Image();
    image.onload = () => {
      resolve({ url: imageUrl, ok: true });
    };
    image.onerror = () => {
      // Soft-fail: the lightbox still opens; BlurImage shows the broken state.
      resolve({ url: imageUrl, ok: false });
    };
    image.src = imageUrl;
  });
}
