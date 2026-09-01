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
      params: { publicId: "missing-baby" },
      route: Route,
    }),
  ).rejects.toMatchObject({ isNotFound: true });

  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Nova" });
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
      params: { publicId: baby.publicId },
      route: Route,
    }),
  ).rejects.toMatchObject({
    options: {
      params: { publicId: renamed?.publicId },
      replace: true,
      to: "/baby/$publicId/login",
    },
  });
});

test("sign-in in the overlay dismisses back to the baby page", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  const signInEmail = vi.fn().mockResolvedValue({ data: null, error: null });
  const original = {
    headers: loginAuthAdapter.headers,
    signInEmail: loginAuthAdapter.signInEmail,
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
    initialEntry: `/baby/${baby.publicId}/login`,
    overlayHistory: { overlayPush: true, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/login",
    route: Route,
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
