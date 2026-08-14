import { authServer } from "@/lib/auth-server";
import { convexQuery } from "@convex-dev/react-query";
import { getConvexQueryPreloader } from "@workspace/convex-prefetch";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@workspace/convex/convex/_generated/api";
import { noIndexHeaders } from "@/lib/robots";

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
    const preloader = getConvexQueryPreloader(opts.context.queryClient);

    if (typeof window === "undefined") {
      const token = opts.context.token ?? (await getAuthToken());
      if (!token) {
        throw redirect({ to: "/" });
      }
      // Mutations via the Convex React client during SSR need setAuth too
      opts.context.convexClient.setAuth(async () => token);

      const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
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
    }

    // Client navigations: the cached profile IS the auth signal — no token
    // round-trip (sign-out does a full page reload, so the cache can't say
    // "signed in" after logging out). A null profile means logged out or a
    // first-ever visit before ensure ran: confirm with the server function
    // once, then ensure the profile row exists.
    const profileHandle = await preloader.ensureQueryData(api.profile.get, {});
    const existingProfile = profileHandle.initialData;
    if (existingProfile) {
      return { locale: existingProfile.locale, token: opts.context.token, isAuthenticated: true };
    }

    const token = await getAuthToken();
    if (!token) {
      throw redirect({ to: "/" });
    }
    const profile = await opts.context.convexClient.mutation(api.profile.ensure, {
      browserLocale: opts.context.locale,
    });
    opts.context.queryClient.setQueryData(convexQuery(api.profile.get, {}).queryKey, profile);
    return { locale: profile.locale, token, isAuthenticated: true };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
