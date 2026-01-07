import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

// Derive CONVEX_SITE_URL from CONVEX_URL
// Example: https://festive-frog-654.convex.cloud -> https://festive-frog-654.convex.site
function getConvexSiteUrl(): string {
  // If explicitly set, use it
  if (process.env.VITE_CONVEX_SITE_URL) {
    return process.env.VITE_CONVEX_SITE_URL;
  }

  // Derive from VITE_CONVEX_URL by replacing .convex.cloud with .convex.site
  if (process.env.VITE_CONVEX_URL) {
    return process.env.VITE_CONVEX_URL.replace(".convex.cloud", ".convex.site");
  }

  throw new Error(
    "VITE_CONVEX_URL or VITE_CONVEX_SITE_URL must be set. " +
      "VITE_CONVEX_SITE_URL is derived from VITE_CONVEX_URL by replacing .convex.cloud with .convex.site",
  );
}

export const authServer = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: getConvexSiteUrl(),
});
