import { QueryClient } from "@tanstack/react-query";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { expect, test, vi } from "vitest";
import {
  browserImageQueryOptions,
  prefetchBrowserImage,
} from "@/lib/image-prefetch";

function queryClientResource() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return makeResource(queryClient, () => {
    queryClient.clear();
  });
}

test("keeps a stable query key scoped by image URL", () => {
  const url = "https://cdn.example/full.jpg";
  expect(browserImageQueryOptions(url).queryKey).toEqual(["browserImagePrefetch", url]);
  expect(browserImageQueryOptions(url).queryKey).toEqual(browserImageQueryOptions(url).queryKey);
});

test("prefetches the image into the query cache in the browser", async () => {
  await using queryClient = queryClientResource();
  const url = "https://cdn.example/full.jpg";

  const OriginalImage = globalThis.Image;
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => {
        this.onload?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);
  await using _image = makeResource({}, () => {
    vi.stubGlobal("Image", OriginalImage);
  });

  const handle = prefetchBrowserImage(queryClient, url);

  expect(handle).toMatchObject({ input: url });
  await vi.waitFor(() => {
    expect(queryClient.getQueryData(browserImageQueryOptions(url).queryKey)).toEqual({
      url,
      ok: true,
    });
  });
});

test("does not construct Image while prefetching on the server", async () => {
  await using queryClient = queryClientResource();
  const url = "https://cdn.example/full.jpg";
  const originalWindow = globalThis.window;
  vi.stubGlobal("window", undefined);
  await using _window = makeResource({}, () => {
    vi.unstubAllGlobals();
    globalThis.window = originalWindow;
  });

  const ImageSpy = vi.fn();
  vi.stubGlobal("Image", ImageSpy);

  const ensureSpy = vi.spyOn(queryClient, "ensureQueryData");
  const handle = prefetchBrowserImage(queryClient, url);

  expect(handle).toMatchObject({ input: url });
  expect(ensureSpy).not.toHaveBeenCalled();
  expect(ImageSpy).not.toHaveBeenCalled();
  expect(queryClient.getQueryData(browserImageQueryOptions(url).queryKey)).toBeUndefined();
});

test("soft-fails when the image fails to load", async () => {
  await using queryClient = queryClientResource();
  const url = "https://cdn.example/missing.jpg";

  const OriginalImage = globalThis.Image;
  class MockImage {
    onload: (() => void) | null = null;
    onerror: (() => void) | null = null;
    set src(_value: string) {
      queueMicrotask(() => {
        this.onerror?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);
  await using _image = makeResource({}, () => {
    vi.stubGlobal("Image", OriginalImage);
  });

  prefetchBrowserImage(queryClient, url);

  await vi.waitFor(() => {
    expect(queryClient.getQueryData(browserImageQueryOptions(url).queryKey)).toEqual({
      url,
      ok: false,
    });
  });
});
