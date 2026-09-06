import { authServer } from "@/lib/auth-server";
import { loadSignedInProfile } from "@/lib/signed-in-profile";
import type { SignedInProfileContext } from "@/lib/signed-in-profile";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import { createFileRoute, notFound, Outlet, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const getAuthToken = createServerFn({ method: "GET" }).handler(async () => {
  return await authServer.getToken();
});

function redirectToBabyLogin(opts: { pathname: string; publicId: string }): never {
  throw redirect({
    params: { publicId: opts.publicId },
    replace: true,
    search: { redirect: opts.pathname },
    to: "/baby/$publicId/login",
  });
}

/**
 * Same signed-in profile check as `/_auth`, then 404 if the caller cannot
 * manage this baby. Expired sessions bounce to the baby-page login overlay.
 *
 * @internal exported for tests
 */
export async function resolveBabyManagerGuard(opts: {
  context: SignedInProfileContext;
  fetchToken: () => Promise<string | null>;
  pathname: string;
  publicId: string;
}) {
  const session = await loadSignedInProfile({
    context: opts.context,
    fetchToken: opts.fetchToken,
  });
  if (!session) {
    redirectToBabyLogin({
      pathname: opts.pathname,
      publicId: opts.publicId,
    });
  }
  const managerBaby = await opts.context.convexPreloader.ensureQueryData(api.baby.getManagerBaby, {
    babyId: opts.publicId,
  });
  if (managerBaby.initialData === FORBIDDEN) {
    throw notFound();
  }
  return session;
}

export const Route = createFileRoute("/baby/$publicId/_auth")({
  beforeLoad: async (opts) => {
    return await resolveBabyManagerGuard({
      context: opts.context,
      fetchToken: async () => (await getAuthToken()) ?? null,
      pathname: opts.location.pathname,
      publicId: opts.params.publicId,
    });
  },
  component: BabyManagerAuthLayout,
});

function BabyManagerAuthLayout() {
  return <Outlet />;
}
