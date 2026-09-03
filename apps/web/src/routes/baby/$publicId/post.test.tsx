import { fireEvent } from "@testing-library/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby, signUpTestUser } from "@/test/convexTestSeed";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { runRouteLoader } from "@/test/routeTestContext";
import { Route } from "@/routes/baby/$publicId/post";

test("post loader fetches manager access data", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  const result = await runRouteLoader<{
    managerBaby: { initialData: { name: string }; input: { babyId: string } };
    myAccess: { initialData: { canManage: boolean; isCoParent: boolean; isOwner: boolean } };
  }>({
    harness,
    params: { publicId: baby.publicId },
    route: Route,
  });

  expect(result.managerBaby).toMatchObject({
    initialData: { name: "Baby Smith" },
    input: { babyId: baby.publicId },
  });
  expect(result.myAccess).toMatchObject({
    initialData: { canManage: true, isCoParent: false, isOwner: true },
  });
});

test("post loader 404s for non-managers", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const aliceId = await signUpTestUser(harness, {
    email: "alice@example.com",
    name: "Alice",
    password: "password123",
  });
  harness.withIdentity({ subject: aliceId });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });
  harness.withIdentity(null);

  await expect(
    runRouteLoader({
      harness,
      params: { publicId: baby.publicId },
      route: Route,
    }),
  ).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("post overlay closes to the baby page after dismiss", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/post`,
    overlayHistory: { overlayPush: false, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/post",
    route: Route,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  expect(ctx.back).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      params: { publicId: baby.publicId },
      replace: true,
      resetScroll: false,
      to: "/baby/$publicId",
    });
  });
});

test("post overlay asks to discard a dirty composer before closing", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/post`,
    overlayHistory: { overlayPush: false, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/post",
    route: Route,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });

  fireEvent.change(ctx.view.getByPlaceholderText("Write a message (optional)…"), {
    target: { value: "Draft update" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("alertdialog")).toBeTruthy();
  });
  expect(ctx.navigate).not.toHaveBeenCalled();

  fireEvent.click(ctx.view.getByRole("button", { name: "Keep editing" }));
  await vi.waitFor(() => {
    expect(ctx.view.queryByRole("alertdialog")).toBeNull();
  });
  expect(ctx.view.getByPlaceholderText("Write a message (optional)…")).toBeTruthy();

  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));
  fireEvent.click(ctx.view.getByRole("button", { name: "Discard" }));

  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      params: { publicId: baby.publicId },
      replace: true,
      resetScroll: false,
      to: "/baby/$publicId",
    });
  });
});

test("discard prompt blocks interaction with the post composer behind it", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/post`,
    overlayHistory: { overlayPush: true, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/post",
    route: Route,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });

  fireEvent.change(ctx.view.getByPlaceholderText("Write a message (optional)…"), {
    target: { value: "Draft update" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("alertdialog")).toBeTruthy();
  });
  expect(ctx.back).not.toHaveBeenCalled();
  expect(ctx.navigate).not.toHaveBeenCalled();
  // Nested alert dialogs skip their backdrop unless forceRender is set.
  expect(ctx.view.baseElement.querySelector('[data-slot="alert-dialog-overlay"]')).toBeTruthy();
});

test("post overlay prefers history.back when opened via push", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/post`,
    overlayHistory: { overlayPush: true, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/post",
    route: Route,
    wrap: null,
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

test("BabyPostUpdateOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/post`,
    overlayHistory: null,
    path: "/baby/$publicId/post",
    route: Route,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getAllByText("Post an update").length).toBeGreaterThan(0);
});

test("successful post completes onboarding step", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    name: "Owner",
    password: "password123",
  });
  harness.withIdentity({ subject: ownerId });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/post`,
    overlayHistory: { overlayPush: false, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/post",
    route: Route,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });

  fireEvent.change(ctx.view.getByPlaceholderText("Write a message (optional)…"), {
    target: { value: "First update!" },
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Post update" }));

  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.completedSteps).toContain("post_update");
  });
});
