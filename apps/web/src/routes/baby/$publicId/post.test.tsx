import { fireEvent } from "@testing-library/react";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { DEFAULT_MILESTONE_VISIBILITY } from "@workspace/convex/src/types";
import { expect, test, vi } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby, signUpTestUser } from "@/test/convexTestSeed";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { renderWithOverlayRouter } from "@/test/renderWithOverlayRouter";
import { runRouteLoader } from "@/test/routeTestContext";
import { BabyPostUpdateOverlayView, Route } from "@/routes/baby/$publicId/post";

const managerBabyDoc = {
  _id: "baby-id" as Id<"baby">,
  _creationTime: 1,
  name: "Baby Smith",
  dueDate: "2026-09-01",
  dueDateDisplayMode: "exact" as const,
  publicDueDateText: null,
  theme: null,
  locale: null,
  resolvedLocale: "en-GB" as const,
  timeZone: "Europe/London",
  laborStarted: null,
  wentToHospital: null,
  babyBorn: null,
  milestoneVisibility: DEFAULT_MILESTONE_VISIBILITY,
  photoId: null,
  birthJourney: "labor" as const,
  publicId: "baby-smith",
};

test("post loader fetches manager access data", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  const result = await runRouteLoader<{
    managerBaby: { input: { babyId: string }; initialData: { name: string } };
    myAccess: { initialData: { canManage: boolean; isOwner: boolean; isCoParent: boolean } };
  }>({
    harness,
    route: Route,
    params: { publicId: baby.publicId },
  });

  expect(result.managerBaby).toMatchObject({
    input: { babyId: baby.publicId },
    initialData: { name: "Baby Smith" },
  });
  expect(result.myAccess).toMatchObject({
    initialData: { canManage: true, isOwner: true, isCoParent: false },
  });
});

test("post loader redirects non-managers to the public baby page", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const aliceId = await signUpTestUser(harness, {
    email: "alice@example.com",
    password: "password123",
    name: "Alice",
  });
  harness.withIdentity({ subject: aliceId });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  harness.withIdentity(null);

  await expect(
    runRouteLoader({
      harness,
      route: Route,
      params: { publicId: baby.publicId },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: baby.publicId },
      resetScroll: false,
    },
  });
});

test("post overlay closes to the baby page after dismiss", async () => {
  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabyPostUpdateOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        completeOnboardingStep={() => undefined}
        renderComposer={(opts) => (
          <button type="button" onClick={() => opts.onPosted()}>
            post for {opts.babyName}
          </button>
        )}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("button", { name: "post for Baby Smith" })).toBeTruthy();
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  expect(ctx.back).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      replace: true,
      resetScroll: false,
    });
  });
});

test("post overlay prefers history.back when opened via push", async () => {
  await using ctx = await renderWithOverlayRouter({
    overlayPush: true,
    wrap: null,
    ui: (
      <BabyPostUpdateOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        completeOnboardingStep={() => undefined}
        renderComposer={(opts) => (
          <button type="button" onClick={() => opts.onPosted()}>
            post for {opts.babyName}
          </button>
        )}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalledOnce();
  });
  expect(ctx.navigate).not.toHaveBeenCalled();
});

test("successful post completes onboarding and closes the overlay", async () => {
  const completeStep = vi
    .fn<(args: { stepId: "post_update" }) => Promise<void>>()
    .mockResolvedValue(undefined);

  await using ctx = await renderWithOverlayRouter({
    overlayPush: false,
    wrap: null,
    ui: (
      <BabyPostUpdateOverlayView
        publicId="baby-smith"
        managerBabyDoc={managerBabyDoc}
        completeOnboardingStep={completeStep}
        renderComposer={(opts) => (
          <button type="button" onClick={() => opts.onPosted()}>
            post for {opts.babyName}
          </button>
        )}
      />
    ),
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "post for Baby Smith" }));

  expect(completeStep).toHaveBeenCalledWith({ stepId: "post_update" });
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      to: "/baby/$publicId",
      params: { publicId: "baby-smith" },
      replace: true,
      resetScroll: false,
    });
  });
});

test("BabyPostUpdateOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/post",
    initialEntry: `/baby/${baby.publicId}/post`,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getAllByText("Post an update").length).toBeGreaterThan(0);
});
