import { fireEvent } from "@testing-library/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { expect, test, vi } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedBabyWithPhoto, seedOwnedBaby, patchOwnedBaby } from "@/test/convexTestSeed";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { runRouteBeforeLoad, runRouteLoader } from "@/test/routeTestContext";
import { Route } from "@/routes/baby/$publicId/photo";

test("beforeLoad 404s unknown babies", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: "missing-baby" },
    }),
  ).rejects.toMatchObject({
    isNotFound: true,
  });
});

test("beforeLoad redirects when the public id resolves to a different slug", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Working Title", dueDate: "2026-09-01" });
  await patchOwnedBaby(harness, {
    id: baby.babyId,
    data: {
      name: "Final Name",
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
      to: "/baby/$publicId/photo",
      params: { publicId: renamed?.publicId },
      replace: true,
    },
  });
});

test("beforeLoad allows matching public ids", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedBabyWithPhoto(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: baby.publicId },
    }),
  ).resolves.toBeUndefined();
});

test("loader redirects home when the baby has no page photo", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

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

test("loader prefetches the full image in the browser", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedBabyWithPhoto(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const publicBaby = await harness.client.query(api.baby.getByPublicId, { id: baby.publicId });
  const photoUrl = publicBaby?.photoUrl;
  if (!photoUrl) {
    throw new Error("expected seeded baby photo URL");
  }

  await using _image = stubBrowserImageResource();

  const data = await runRouteLoader<{ imagePrefetch: { input: string | undefined } }>({
    harness,
    route: Route,
    params: { publicId: baby.publicId },
  });

  expect(data.imagePrefetch).toMatchObject({ input: photoUrl });
  await vi.waitFor(() => {
    expect(harness.queryClient.getQueryData(["browserImagePrefetch", photoUrl])).toEqual({
      url: photoUrl,
      ok: true,
    });
  });
});

test("dismisses the lightbox overlay after the dialog closes", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedBabyWithPhoto(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/photo",
    initialEntry: `/baby/${baby.publicId}/photo`,
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

test("BabyPhotoOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedBabyWithPhoto(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/photo",
    initialEntry: `/baby/${baby.publicId}/photo`,
    overlayHistory: null,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByAltText("Photo of Baby Smith")).toBeTruthy();
});
