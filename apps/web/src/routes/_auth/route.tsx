import { authServer } from "@/lib/auth-server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { api } from "@workspace/convex/convex/_generated/api";
import { noIndexHeaders } from "@/lib/robots";

// Server function to check authentication
const getToken = createServerFn({ method: "GET" }).handler(async () => {
  const token = await authServer.getToken();
  return token;
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
    // Check authentication server-side
    const token = await getToken();

    if (!token) {
      throw redirect({
        to: "/",
      });
    }
    if (typeof window === "undefined") {
      opts.context.convexClient.setAuth(async () => {
        return token;
      });
    }
    const existingProfile = await opts.context.convexClient.query(api.profile.get, {});
    const profile =
      existingProfile ??
      (await opts.context.convexClient.mutation(api.profile.ensure, {
        browserLocale: opts.context.locale,
      }));
    return { locale: profile.locale };
  },
  component: AuthLayout,
});

function AuthLayout() {
  return <Outlet />;
}
