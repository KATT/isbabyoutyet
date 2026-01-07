import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

// Determine the site URL for Better Auth
// For local development, default to localhost:3000
// For production/preview, use VITE_CONVEX_SITE_URL or derive from Vercel env vars
function getSiteUrl(): string {
  // If explicitly set, use it
  if (process.env.VITE_CONVEX_SITE_URL) {
    return process.env.VITE_CONVEX_SITE_URL;
  }

  // For Vercel deployments, construct from VERCEL_URL
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  // For local development, default to localhost:3000
  return "http://localhost:3000";
}

export const authServer = convexBetterAuthReactStart({
  convexUrl: process.env.VITE_CONVEX_URL!,
  convexSiteUrl: getSiteUrl(),
});
