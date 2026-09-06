import { createRouter } from "@tanstack/react-router";
import { QueryClient } from "@tanstack/react-query";
import { setupRouterSsrQueryIntegration } from "@tanstack/react-router-ssr-query";
import { ConvexQueryClient } from "@convex-dev/react-query";
import { ConvexProvider } from "convex/react";
import { routeTree } from "./routeTree.gen";
import {
  convexInfiniteQueryFn,
  getConvexQueryPreloader,
  registerConvexInfiniteQueryClient,
} from "@workspace/convex-prefetch";
import { RootErrorComponent } from "./routes/__root";
import { setupClientConvexAuth } from "./lib/convex-auth";
import { authDebug, debugIdFor, installAuthDebugDump } from "./lib/auth-debug";
import { getDetectedLocale } from "./lib/i18n";

/** Router preload policy — tested without constructing the full client graph. */
export const routerPreloadOptions = {
  defaultPreload: "viewport",
  // React Query is the cache of record, so preloaded loader data must be
  // immediately stale to the router: loaders re-run (as cheap ensureQueryData
  // cache hits) instead of the router serving its own ≤30s-old snapshot.
  // Navigation still commits instantly — stale matches revalidate in the
  // background. https://tanstack.com/router/latest/docs/guide/data-loading
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
} as const;

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
        // Handles both regular Convex queries and infinite/paginated keys.
        queryFn: convexInfiniteQueryFn(convexQueryClient),
      },
    },
  });
  convexQueryClient.connect(queryClient);
  const convexPreloader = getConvexQueryPreloader(queryClient);

  // Resolve auth (signed-in or anonymous) before React mounts — see the
  // function's doc comment for why the auth provider alone is not enough.
  if (globalThis.window !== undefined) {
    installAuthDebugDump();
    authDebug("getRouter", {
      convexClient: debugIdFor(convexQueryClient.convexClient, "convexClient"),
      convexQueryClient: debugIdFor(convexQueryClient, "convexQueryClient"),
      queryClient: debugIdFor(queryClient, "queryClient"),
    });
    setupClientConvexAuth(convexQueryClient, queryClient);
  }

  const router = createRouter({
    routeTree,
    // Viewport preload runs loaders when a Link scrolls into view (not just on
    // hover/focus), so e.g. visible dashboard baby cards prefetch their baby
    // pages via the ensureQueryData prefetchers.
    ...routerPreloadOptions,
    // Friendly recoverable fallback for any route error (reload / go home).
    context: {
      convexClient: convexQueryClient.convexClient,
      convexPreloader,
      convexQueryClient,
      isAuthenticated: false,
      locale: getDetectedLocale(),
      queryClient,
      token: null,
    },
    defaultErrorComponent: RootErrorComponent,
    scrollRestoration: true,
    Wrap: (props) => (
      <ConvexProvider client={convexQueryClient.convexClient}>{props.children}</ConvexProvider>
    ),
  });

  setupRouterSsrQueryIntegration({ queryClient, router });

  return router;
}
