import { fireEvent } from "@testing-library/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import {
  seedOwnedBaby,
  seedTimelineUpdateWithPhoto,
  patchOwnedBaby,
  postTestUpdate,
} from "@/test/convexTestSeed";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { runRouteBeforeLoad, runRouteLoader } from "@/test/routeTestContext";
import { Route } from "@/routes/baby/$publicId/updates.$updateId.photo";

test("update photo beforeLoad 404s unknown babies", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  await expect(
    runRouteBeforeLoad({
      harness,
      params: { publicId: "missing-baby", updateId: "jd7update00000000000000001" },
      route: Route,
    }),
  ).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("update photo beforeLoad redirects when the public id resolves to a different slug", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Nova" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
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
      params: { publicId: baby.publicId, updateId: update.updateId },
      route: Route,
    }),
  ).rejects.toMatchObject({
    options: {
      params: { publicId: renamed?.publicId, updateId: update.updateId },
      replace: true,
      to: "/baby/$publicId/updates/$updateId/photo",
    },
  });
});

test("update photo beforeLoad allows matching public ids", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });

  await expect(
    runRouteBeforeLoad({
      harness,
      params: { publicId: baby.publicId, updateId: update.updateId },
      route: Route,
    }),
  ).resolves.toBeUndefined();
});

test("update photo loader redirects home when the update has no photo", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });
  const updateId = await postTestUpdate(harness, {
    babyId: baby.babyId,
    message: "Text only",
  });

  await expect(
    runRouteLoader({
      harness,
      params: { publicId: baby.publicId, updateId },
      route: Route,
    }),
  ).rejects.toMatchObject({
    options: {
      params: { publicId: baby.publicId },
      resetScroll: false,
      to: "/baby/$publicId",
    },
  });
});

test("update photo loader prefetches the full image in the browser", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  const photo = await harness.client.query(api.timeline.getUpdatePhoto, {
    babyId: baby.publicId,
    updateId: update.updateId,
  });
  const photoUrl = photo?.photoUrl;
  if (!photoUrl) {
    throw new Error("expected update photo URL");
  }

  await using _image = stubBrowserImageResource();

  const data = await runRouteLoader<{ imagePrefetch: { input: string | undefined } }>({
    harness,
    params: { publicId: baby.publicId, updateId: update.updateId },
    route: Route,
  });

  expect(data.imagePrefetch).toMatchObject({ input: photoUrl });
  await vi.waitFor(() => {
    expect(harness.queryClient.getQueryData(["browserImagePrefetch", photoUrl])).toEqual({
      ok: true,
      url: photoUrl,
    });
  });
});

test("dismisses the update photo overlay after the dialog closes", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/updates/${update.updateId}/photo`,
    overlayHistory: { overlayPush: true, parentEntry: `/baby/${baby.publicId}` },
    path: "/baby/$publicId/updates/$updateId/photo",
    route: Route,
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
  const baby = await seedOwnedBaby(harness, { dueDate: "2026-09-01", name: "Baby Smith" });
  const update = await seedTimelineUpdateWithPhoto(harness, {
    babyId: baby.babyId,
    message: "Photo update",
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    initialEntry: `/baby/${baby.publicId}/updates/${update.updateId}/photo`,
    overlayHistory: null,
    path: "/baby/$publicId/updates/$updateId/photo",
    route: Route,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
});
