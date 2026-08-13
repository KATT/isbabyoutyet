import { createRouter } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { routeTree } from "./routeTree.gen";
import { getConvexClient } from "./get-convex-client";
import { getDetectedLocale } from "./lib/i18n";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export function getRouter() {
  const convexClient = getConvexClient();

  const router = createRouter({
    routeTree,
    defaultPreload: "viewport",
    context: { convexClient, locale: getDetectedLocale() },
    scrollRestoration: true,
    Wrap: (props) => (
      <QueryClientProvider client={queryClient}>
        <ConvexProvider client={convexClient}>{props.children}</ConvexProvider>
      </QueryClientProvider>
    ),
  });

  return router;
}
