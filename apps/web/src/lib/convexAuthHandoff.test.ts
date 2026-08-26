import { expect, test, vi } from "vitest";
import { reportConvexAuthState, waitForConvexAuth } from "./convexAuthHandoff";

test("waits until the provider confirms completed Convex authentication", async () => {
  reportConvexAuthState({ isAuthenticated: false, isLoading: false });
  const confirmed = vi.fn();
  const waiting = waitForConvexAuth().then(confirmed);

  await Promise.resolve();
  expect(confirmed).not.toHaveBeenCalled();

  reportConvexAuthState({ isAuthenticated: true, isLoading: true });
  await Promise.resolve();
  expect(confirmed).not.toHaveBeenCalled();

  reportConvexAuthState({ isAuthenticated: true, isLoading: false });
  await waiting;
  expect(confirmed).toHaveBeenCalledTimes(1);
});

test("resolves immediately when Convex auth is already confirmed", async () => {
  reportConvexAuthState({ isAuthenticated: true, isLoading: false });

  await expect(waitForConvexAuth()).resolves.toBeUndefined();
});

test("waits for a new confirmation after Convex reports sign-out", async () => {
  reportConvexAuthState({ isAuthenticated: true, isLoading: false });
  reportConvexAuthState({ isAuthenticated: false, isLoading: false });
  const confirmed = vi.fn();
  const waiting = waitForConvexAuth().then(confirmed);

  await Promise.resolve();
  expect(confirmed).not.toHaveBeenCalled();

  reportConvexAuthState({ isAuthenticated: true, isLoading: false });
  await waiting;
  expect(confirmed).toHaveBeenCalledTimes(1);
});
