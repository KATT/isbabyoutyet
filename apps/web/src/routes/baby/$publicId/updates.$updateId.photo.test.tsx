import { fireEvent } from "@testing-library/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby, seedTimelineUpdateWithPhoto } from "@/test/convexTestSeed";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { runRouteBeforeLoad, runRouteLoader } from "@/test/routeTestContext";
import { Route } from "@/routes/baby/$publicId/updates.$updateId.photo";

test("update photo beforeLoad 404s unknown babies", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: "missing-baby", updateId: "jd7update00000000000000001" },
    }),
  ).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("update photo beforeLoad redirects when the public id resolves to a different slug", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Nova", dueDate: "2026-09-01" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  await harness.client.mutation(api.baby.update, {
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
      params: { publicId: baby.publicId, updateId: update.updateId },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId/updates/$updateId/photo",
      params: { publicId: renamed?.publicId, updateId: update.updateId },
      replace: true,
    },
  });
});

test("update photo beforeLoad allows matching public ids", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });

  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: baby.publicId, updateId: update.updateId },
    }),
  ).resolves.toBeUndefined();
});

test("update photo loader redirects home when the update has no photo", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const updateId = await harness.client.mutation(api.updates.post, {
    babyId: baby.babyId,
    message: "Text only",
  });

  await expect(
    runRouteLoader({
      harness,
      route: Route,
      params: { publicId: baby.publicId, updateId },
    }),
  ).rejects.toMatchObject({
    options: {
      to: "/baby/$publicId",
      params: { publicId: baby.publicId },
      resetScroll: false,
    },
  });
});

test("update photo loader prefetches the full image in the browser", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  const photo = await harness.client.query(api.timeline.getUpdatePhoto, {
    babyId: baby.publicId,
    updateId: update.updateId,
  });
  const photoUrl = photo?.photoUrl;
  if (!photoUrl) throw new Error("expected update photo URL");

  await using _image = stubBrowserImageResource();

  const data = await runRouteLoader<{ imagePrefetch: { input: string | undefined } }>({
    harness,
    route: Route,
    params: { publicId: baby.publicId, updateId: update.updateId },
  });

  expect(data.imagePrefetch).toMatchObject({ input: photoUrl });
  await vi.waitFor(() => {
    expect(harness.queryClient.getQueryData(["browserImagePrefetch", photoUrl])).toEqual({
      url: photoUrl,
      ok: true,
    });
  });
});

test("dismisses the update photo overlay after the dialog closes", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/updates/$updateId/photo",
    initialEntry: `/baby/${baby.publicId}/updates/${update.updateId}/photo`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: true },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
  fireEvent.click(ctx.view.getByRole("button", { name: "Close photo" }));
  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalled();
  });
});

test("BabyUpdatePhotoOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/updates/$updateId/photo",
    initialEntry: `/baby/${baby.publicId}/updates/${update.updateId}/photo`,
    overlayHistory: null,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
});
