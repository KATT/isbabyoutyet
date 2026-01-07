import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

if (!process.env.VITE_CONVEX_URL) {
  throw new Error("VITE_CONVEX_URL must be set");
}

if (!process.env.VITE_CONVEX_SITE_URL) {
  throw new Error("VITE_CONVEX_SITE_URL must be set");
}

export const authServer = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: process.env.VITE_CONVEX_SITE_URL!,
});
