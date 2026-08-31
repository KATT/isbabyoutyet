import { convexQuery } from "@convex-dev/react-query";
import { fireEvent } from "@testing-library/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { makeResource } from "@workspace/convex/convex/test.resource";
import { expect, test, vi } from "vitest";
import { getBabySeo } from "@/lib/baby-seo";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby } from "@/test/convexTestSeed";
import { renderMountedFileRoute, stubBrowserImageResource } from "@/test/renderMountedFileRoute";
import { runRouteBeforeLoad, runRouteLoader } from "@/test/routeTestContext";
import { Route } from "@/routes/baby/$publicId/share";

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
  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
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
      to: "/baby/$publicId/share",
      params: { publicId: renamed?.publicId },
      replace: true,
    },
  });
});

test("loader prefetches the canonical OG image in the browser", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
      theme: "baby-blue",
    },
  });
  await using _image = stubBrowserImageResource();

  const data = await runRouteLoader<{
    imagePrefetch: { input: string | undefined };
    myAccess: { initialData: { canManage: boolean } };
    shareLink: string;
  }>({
    harness,
    route: Route,
    params: { publicId: baby.publicId },
  });

  const babyDoc = await harness.client.query(api.baby.getByPublicId, { id: baby.publicId });
  if (!babyDoc) throw new Error("expected baby");
  const prefetchedImageUrl = new URL(data.imagePrefetch.input ?? "");
  expect(prefetchedImageUrl.pathname).toBe(`/og/baby/${baby.publicId}`);
  expect(prefetchedImageUrl.searchParams.get("v")).toBeTruthy();
  expect(data.imagePrefetch.input).toBe(getBabySeo(babyDoc, baby.publicId).imageUrl);
  expect(data.myAccess.initialData.canManage).toBe(true);
  expect(data.shareLink).toBe(`https://isbabyoutyet.com/baby/${baby.publicId}`);
});

test("loader replaces a cached old theme with the fresh baby snapshot", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
      theme: "orange",
    },
  });
  const staleBaby = await harness.client.query(api.baby.getByPublicId, { id: baby.publicId });
  if (!staleBaby) throw new Error("expected baby");
  harness.queryClient.setQueryData(
    convexQuery(api.baby.getByPublicId, { id: baby.publicId }).queryKey,
    staleBaby,
  );

  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
      theme: "baby-blue",
    },
  });
  await using _image = stubBrowserImageResource();

  const data = await runRouteLoader<{ imagePrefetch: { input: string | undefined } }>({
    harness,
    route: Route,
    params: { publicId: baby.publicId },
  });

  const freshBaby = await harness.client.query(api.baby.getByPublicId, { id: baby.publicId });
  if (!freshBaby) throw new Error("expected baby");
  expect(data.imagePrefetch.input).toBe(getBabySeo(freshBaby, baby.publicId).imageUrl);
  expect(freshBaby.theme).toBe("baby-blue");
});

test("copies from the route overlay and dismisses through overlay history", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
      theme: "baby-blue",
    },
  });
  const babyDoc = await harness.client.query(api.baby.getByPublicId, { id: baby.publicId });
  if (!babyDoc) throw new Error("expected baby");
  const preview = getBabySeo(babyDoc, baby.publicId);
  const writeText = vi.fn<(text: string) => Promise<void>>().mockResolvedValue(undefined);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  await using _clipboard = makeResource({}, () => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/share",
    initialEntry: `/baby/${baby.publicId}/share`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: true },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  const image = ctx.view.getByRole("img", { name: preview.title });
  expect(image.getAttribute("src")).toBe(preview.imageUrl);
  fireEvent.click(ctx.view.getByRole("button", { name: "Copy link to share" }));
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalledWith(`https://isbabyoutyet.com/baby/${baby.publicId}`);
    expect(ctx.view.getByRole("button", { name: "Copied!" })).toBeTruthy();
  });
  await vi.waitFor(async () => {
    const progress = await harness.client.query(api.onboarding.getMine, {});
    expect(progress.completedSteps).toContain("share_link");
  });

  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));
  await vi.waitFor(() => {
    expect(ctx.back).toHaveBeenCalledOnce();
  });
});

test("BabyShareOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
      theme: "baby-blue",
    },
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/share",
    initialEntry: `/baby/${baby.publicId}/share`,
    overlayHistory: null,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("heading", { name: "Share the Link" })).toBeTruthy();
});

test("share overlay falls back to execCommand when clipboard.writeText fails", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  await harness.client.mutation(api.baby.update, {
    id: baby.babyId,
    data: {
      theme: "baby-blue",
    },
  });
  const writeText = vi.fn<() => Promise<void>>().mockRejectedValue(new Error("denied"));
  const execCommand = vi.fn<() => boolean>().mockReturnValue(true);
  const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  await using _clipboard = makeResource({}, () => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  const hadExecCommand = "execCommand" in document;
  const originalExecCommand = document.execCommand;
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: execCommand,
  });
  await using _exec = makeResource({}, () => {
    if (hadExecCommand) {
      Object.defineProperty(document, "execCommand", {
        configurable: true,
        writable: true,
        value: originalExecCommand,
      });
      return;
    }
    Reflect.deleteProperty(document, "execCommand");
  });
  await using _image = stubBrowserImageResource();

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/share",
    initialEntry: `/baby/${baby.publicId}/share`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: false },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Copy link to share" }));
  await vi.waitFor(() => {
    expect(writeText).toHaveBeenCalled();
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(ctx.view.getByRole("button", { name: "Copied!" })).toBeTruthy();
  });
});
