import { fireEvent } from "@testing-library/react";
import { expect, test, vi } from "vitest";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { DEMO_USER } from "@workspace/convex/src/seedCredentials";
import { loginAuthAdapter } from "@/routes/auth/login";
import { Route } from "@/routes/baby/$publicId/login";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby, patchOwnedBaby } from "@/test/convexTestSeed";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { runRouteBeforeLoad } from "@/test/routeTestContext";

test("beforeLoad validates and canonicalizes the baby slug", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });

  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: "missing-baby" },
    }),
  ).rejects.toMatchObject({ isNotFound: true });

  const baby = await seedOwnedBaby(harness, { name: "Baby Nova", dueDate: "2026-09-01" });
  await patchOwnedBaby(harness, {
    id: baby.babyId,
    patch: {
      name: "Renamed Nova",
    },
  });
  const renamed = await harness.client.query(api.baby.getByPublicId, { id: baby.publicId });

  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: baby.publicId },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId/login",
      params: { publicId: renamed?.publicId },
      replace: true,
    },
  });
});

test("sign-in in the overlay dismisses back to the baby page", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  const signInEmail = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = {
    signInEmail: loginAuthAdapter.signInEmail,
    headers: loginAuthAdapter.headers,
    waitForAuth: loginAuthAdapter.waitForAuth,
  };
  // SAFETY: Test stub replaces the adapter's email sign-in method.
  loginAuthAdapter.signInEmail = signInEmail as typeof loginAuthAdapter.signInEmail;
  loginAuthAdapter.headers = () => ({ "x-time-zone": "Asia/Tokyo" });
  loginAuthAdapter.waitForAuth = async () => undefined;
  await using _adapter = makeResource({}, () => {
    loginAuthAdapter.signInEmail = original.signInEmail;
    loginAuthAdapter.headers = original.headers;
    loginAuthAdapter.waitForAuth = original.waitForAuth;
  });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/login",
    initialEntry: `/baby/${baby.publicId}/login`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: true },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("heading", { name: "Welcome back!" })).toBeTruthy();

  fireEvent.change(ctx.view.getByLabelText("Email"), { target: { value: DEMO_USER.email } });
  fireEvent.change(ctx.view.getByLabelText("Password"), { target: { value: DEMO_USER.password } });
  fireEvent.click(ctx.view.getByRole("button", { name: /sign in/i }));

  await vi.waitFor(() => {
    expect(signInEmail).toHaveBeenCalled();
  });
  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalledOnce();
  });
});
