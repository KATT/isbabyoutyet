import { QueryClientProvider } from "@tanstack/react-query";
import type { AnyRoute } from "@tanstack/react-router";
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { render } from "@testing-library/react";
import { ConvexProvider } from "convex/react";
import type { ReactNode } from "react";
import { ThemeProvider } from "next-themes";
import { vi } from "vitest";
import { makeAsyncResource, makeResource } from "@workspace/convex/convex/test.resource";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { LocaleProvider } from "@/lib/i18n";
import type { ConvexTestHarness } from "@/test/convexTestHarness";
import { routeContextFromHarness } from "@/test/routeTestContext";
import { stubJsdomWindow } from "@/test/stubJsdomWindow";

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
 * production wrapper, backed by `convex-test` through the shared harness.
 */
export async function renderMountedFileRoute(opts: {
  harness: ConvexTestHarness;
  route: AnyRoute;
  path: string;
  initialEntry: string;
  /** Extra providers around the route outlet. */
  wrap: ((children: ReactNode) => ReactNode) | null;
  /**
   * Shape overlay history like production: parent baby page, then push or
   * replace onto the overlay route (controls dismiss via back vs navigate).
   */
  overlayHistory: { parentEntry: string; overlayPush: boolean } | null;
}) {
  const context = routeContextFromHarness(opts.harness);

  const history =
    opts.overlayHistory === null
      ? createMemoryHistory({ initialEntries: [opts.initialEntry] })
      : (() => {
          const overlayHistory = createMemoryHistory({
            initialEntries: [opts.overlayHistory.parentEntry],
          });
          if (opts.overlayHistory.overlayPush) {
            overlayHistory.push(opts.initialEntry, { overlay: true });
          } else {
            overlayHistory.replace(opts.initialEntry);
          }
          return overlayHistory;
        })();

  const rootRoute = createRootRoute({
    component: function TestRoot() {
      const outlet = (
        <QueryClientProvider client={opts.harness.queryClient}>
          <ConvexProvider client={opts.harness.convexClient as never}>
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
    history,
    defaultPendingMinMs: 0,
    context,
  });

  await router.load();

  const jsdomWindow = stubJsdomWindow();
  const navigate = vi.spyOn(router, "navigate");
  const back = vi.spyOn(history, "back");
  const view = render(<RouterProvider router={router} />);
  return makeAsyncResource({ view, router, harness: opts.harness, navigate, back }, async () => {
    navigate.mockRestore();
    back.mockRestore();
    view.unmount();
    jsdomWindow.restore();
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
