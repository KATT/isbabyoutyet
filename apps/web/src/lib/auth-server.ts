import { convexBetterAuthReactStart } from "@convex-dev/better-auth/react-start";

const convexUrl = import.meta.env.VITE_CONVEX_URL!;
const convexSiteUrl = import.meta.env.VITE_CONVEX_SITE_URL!;

console.log("env", {
  convexUrl,
  convexSiteUrl,
});

export const authServer = convexBetterAuthReactStart({
  convexUrl,
  convexSiteUrl,
});

export const {
  handler,
  getToken,
  fetchAuthQuery,
  fetchAuthMutation,
  fetchAuthAction,
} = authServer;
