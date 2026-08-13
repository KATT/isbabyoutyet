import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { routeTree } from "./routeTree.gen";
import { getDetectedLocale } from "./lib/i18n";

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

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        queryKeyHashFn: convexQueryClient.hashFn(),
        queryFn: convexQueryClient.queryFn(),
      },
    },
  });
  convexQueryClient.connect(queryClient);

  const router = createRouter({
    routeTree,
    // Intent preload runs loaders on hover/focus so ensureQueryData prefetchers work
    defaultPreload: "intent",
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
