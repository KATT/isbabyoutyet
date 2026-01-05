import { createRouter } from "@tanstack/react-router";
import { ConvexReactClient } from "convex/react";
import { ConvexProvider } from "convex/react";
import { routeTree } from "./routeTree.gen";

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

export function getConvexClient() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL!;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not set");
  }
  return new ConvexReactClient(convexUrl);
}
