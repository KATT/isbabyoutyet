import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { vi } from "vitest";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { LocaleProvider } from "@/lib/i18n";

/**
 * `Route.update()` is typed for non-structural option tweaks only, so widen it
 * to re-parent the real route (same instance, so its hooks keep resolving)
 * onto a test root.
 */
function reparentRoute<TRoute extends AnyRoute>(
  route: TRoute,
  opts: { path: string; getParentRoute: () => AnyRoute },
): TRoute {
  const update = route.update as (options: typeof opts) => TRoute;
  return update(opts);
}

/**
 * Mounts a real file-route component end-to-end: beforeLoad + loader + the
 * production wrapper, with Convex query data stubbed through a QueryClient
 * `queryFn` map (same pattern as the overlay loader unit tests).
 */
export async function renderMountedFileRoute(opts: {
  route: AnyRoute;
  path: string;
  initialEntry: string;
  handlers: Record<string, unknown>;
  /** Extra providers around the route outlet. */
  wrap: ((children: ReactNode) => ReactNode) | null;
}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: Infinity,
        queryFn: (ctx) => {
          const name = String(ctx.queryKey[1]);
          return Promise.resolve(opts.handlers[name] ?? null);
        },
      },
    },
  });
  const convexClient = new ConvexReactClient("https://example.invalid", {
    unsavedChangesWarning: false,
  });

  const context = {
    queryClient,
    convexPreloader: getConvexQueryPreloader(queryClient),
  };

  const rootRoute = createRootRoute({
    component: function TestRoot() {
      const outlet = (
        <QueryClientProvider client={queryClient}>
          <ConvexProvider client={convexClient}>
            <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
              <TooltipProvider>
                <LocaleProvider locale="en-GB">
                  <Outlet />
                </LocaleProvider>
              </TooltipProvider>
            </ThemeProvider>
          </ConvexProvider>
        </QueryClientProvider>
      );
      return opts.wrap ? <>{opts.wrap(outlet)}</> : outlet;
    },
  });

  const mountedRoute = reparentRoute(opts.route, {
    path: opts.path,
    getParentRoute: () => rootRoute,
  });

  const router = createRouter({
    routeTree: rootRoute.addChildren([mountedRoute]),
    history: createMemoryHistory({ initialEntries: [opts.initialEntry] }),
    defaultPendingMinMs: 0,
    context,
  });

  await router.load();

  const view = render(<RouterProvider router={router} />);
  // Keep the Convex client open for the lifetime of the mounted route; close
  // it when the caller disposes the returned resource.
  return makeAsyncResource({ view, router, queryClient }, async () => {
    view.unmount();
    queryClient.clear();
    await convexClient.close();
  });
}

/** Stub `Image` so browser OG/lightbox prefetch resolves immediately. */
export function stubBrowserImageResource() {
  const OriginalImage = globalThis.Image;
  class MockImage {
    #load: (() => void) | null = null;
    addEventListener(type: string, listener: () => void) {
      if (type === "load") this.#load = listener;
    }
    set src(value: string) {
      void value;
      queueMicrotask(() => {
        this.#load?.();
      });
    }
  }
  vi.stubGlobal("Image", MockImage);
  return makeResource({}, () => {
    vi.stubGlobal("Image", OriginalImage);
  });
}
