import { authServer } from "@/lib/auth-server";
import { convexQuery } from "@convex-dev/react-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@workspace/convex/convex/_generated/api";
import { noIndexHeaders } from "@/lib/robots";
import { preloadPrivateProfile } from "@/lib/convexPrefetch.functions";

// Server function to check authentication
const getAuthToken = createServerFn({ method: "GET" }).handler(async () => {
  return await authServer.getToken();
});

export const Route = createFileRoute("/_auth")({
  headers() {
    return {
      Vary: "Cookie",
      // Prefer header over route `head` — TanStack's head+beforeLoad typing
      // currently collapses child beforeLoad to `never` when the layout sets head.
      ...noIndexHeaders(),
    };
  },
  beforeLoad: async (opts) => {
    // Prefer the root-resolved token when present; fall back to a fresh check
    // for client navigations where root may not have re-fetched yet.
    const token = opts.context.token ?? (await getAuthToken());

    if (!token) {
      throw redirect({
        to: "/",
      });
    }

    // Mutations via the Convex React client during SSR need setAuth too
    if (typeof window === "undefined") {
      opts.context.convexClient.setAuth(async () => token);
    }

    const profileHandle = await preloadPrivateProfile();
    const existingProfile = profileHandle.initialData;
    const profile =
      existingProfile ??
      (await opts.context.convexClient.mutation(api.profile.ensure, {
        browserLocale: opts.context.locale,
      }));

    if (!existingProfile) {
      opts.context.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, profile);
    }

    return { locale: profile.locale, token, isAuthenticated: true };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
