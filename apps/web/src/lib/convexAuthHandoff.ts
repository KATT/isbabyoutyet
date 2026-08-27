import { useConvexAuth } from "convex/react";
import { useEffect } from "react";

type ConvexAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

const authenticatedWaiters = new Set<() => void>();
let isConvexAuthenticated = false;

/** @internal Test/bootstrap seam — production callers go through ConvexAuthObserver. */
export function reportConvexAuthState(state: ConvexAuthState) {
  isConvexAuthenticated = state.isAuthenticated && !state.isLoading;
  if (!isConvexAuthenticated) {
    return;
  }

  for (const resolve of authenticatedWaiters) {
    resolve();
  }
  authenticatedWaiters.clear();
}

export async function waitForConvexAuth() {
  if (isConvexAuthenticated) {
    return;
  }

  await new Promise<void>((resolve) => {
    authenticatedWaiters.add(resolve);
  });
}

/**
 * Reports Convex's documented server-confirmed auth signal. Lives in `lib`
 * because the subscription is an effect; feature routes only mount it.
 */
export function ConvexAuthObserver() {
  const auth = useConvexAuth();
  useEffect(() => {
    // Better Auth exposes its session before Convex has validated the token.
    // useConvexAuth is the documented server-confirmed signal:
    // https://labs.convex.dev/better-auth/basic-usage/authorization
    reportConvexAuthState({
      isAuthenticated: auth.isAuthenticated,
      isLoading: auth.isLoading,
    });
  }, [auth.isAuthenticated, auth.isLoading]);
  return null;
}
