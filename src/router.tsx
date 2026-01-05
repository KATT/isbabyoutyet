import { createRouter } from "@tanstack/react-router";
import { ConvexProvider } from "convex/react";
import { routeTree } from "./routeTree.gen";
import { getConvexClient } from "./get-convex-client";

export function getRouter() {
  const convexClient = getConvexClient();

  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    context: { convexClient },
    scrollRestoration: true,
    Wrap: ({ children }) => <ConvexProvider client={convexClient}>{children}</ConvexProvider>,
  });

  return router;
}
