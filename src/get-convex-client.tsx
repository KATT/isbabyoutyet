import { ConvexReactClient } from "convex/react";

export function getConvexClient() {
  const convexUrl = import.meta.env.VITE_CONVEX_URL!;
  if (!convexUrl) {
    throw new Error("VITE_CONVEX_URL is not set");
  }
  return new ConvexReactClient(convexUrl);
}
