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
