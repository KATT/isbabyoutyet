type ConvexAuthState = {
  isAuthenticated: boolean;
  isLoading: boolean;
};

const authenticatedWaiters = new Set<() => void>();
let isConvexAuthenticated = false;

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
