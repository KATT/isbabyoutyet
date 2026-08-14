import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { routeTree } from "./routeTree.gen";
import {
  convexInfiniteQueryFn,
  registerConvexInfiniteQueryClient,
} from "@workspace/convex-prefetch";
import { Spinner } from "@workspace/ui/components/spinner";
import { getDetectedLocale } from "./lib/i18n";

// Suspense fallback for routes whose data is still streaming in after an
// instant (non-blocking) client navigation.
function RoutePending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background bg-dots">
      <Spinner className="size-8 text-primary" />
    </div>
  );
}

export function getRouter() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL!;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not set");
  }

  // expectAuth keeps SSR-authenticated query results from being dropped on
  // hydration; public pages still run once auth resolves as anonymous.
  const convexQueryClient = new ConvexQueryClient(convexUrl, {
    expectAuth: true,
  });
  registerConvexInfiniteQueryClient(convexQueryClient);

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        // Wraps ConvexQueryClient.queryFn so infinite/paginated keys work too.
        queryFn: convexInfiniteQueryFn(convexQueryClient) as never,
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    // Viewport preload runs loaders when a Link scrolls into view (not just on
    // hover/focus), so e.g. visible dashboard baby cards prefetch their baby
    // pages via the ensureQueryData prefetchers.
    defaultPreload: "viewport",
    // Wraps every route in a Suspense boundary: client navigations commit
    // immediately and this renders while the route's suspense queries load.
    defaultPendingComponent: RoutePending,
    context: {
      queryClient,
      convexQueryClient,
      convexClient: convexQueryClient.convexClient,
      locale: getDetectedLocale(),
      isAuthenticated: false,
      token: null,
    },
    scrollRestoration: true,
    Wrap: (props) => (
      <ConvexProvider client={convexQueryClient.convexClient}>{props.children}</ConvexProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ router, queryClient });

  return router;
}
