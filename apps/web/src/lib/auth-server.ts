import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

// Get the Convex URL from environment
// Use import.meta.env which gets inlined at build time by Vite
// Falls back to process.env for local development
function getConvexUrl(): string {
  // import.meta.env gets inlined at build time
  const url = import.meta.env.VITE_CONVEX_URL;
  if (!url) {
    throw new Error("VITE_CONVEX_URL must be set");
  }
  return url;
}

// Derive CONVEX_SITE_URL from CONVEX_URL
// Example: https://festive-frog-654.convex.cloud -> https://festive-frog-654.convex.site
function getConvexSiteUrl(): string {
  // If explicitly set, use it
  const siteUrl = import.meta.env.VITE_CONVEX_SITE_URL;
  if (siteUrl) {
    return siteUrl;
  }

  // Derive from VITE_CONVEX_URL by replacing .convex.cloud with .convex.site
  const convexUrl = getConvexUrl();
  return convexUrl.replace(".convex.cloud", ".convex.site");
}

export const authServer = convexBetterAuthReactStart({
  convexUrl: getConvexUrl(),
  convexSiteUrl: getConvexSiteUrl(),
});
