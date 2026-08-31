import { fireEvent } from "@testing-library/react";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import { expect, test, vi } from "vitest";
import { createConvexTestHarness } from "@/test/convexTestHarness";
import { seedOwnedBaby, signUpTestUser, patchOwnedBaby } from "@/test/convexTestSeed";
import { renderMountedFileRoute } from "@/test/renderMountedFileRoute";
import { runRouteBeforeLoad, runRouteLoader } from "@/test/routeTestContext";
import { managerDocToBabyData } from "@/routes/baby/$publicId/route";
import { Route } from "@/routes/baby/$publicId/settings";
import { htmlButton } from "@/test/htmlElement";

test("settings loader fetches only manager settings data", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  const result = await runRouteLoader<{
    managerBaby: { input: { babyId: string }; initialData: { name: string } };
    coParentsList: {
      input: { babyId: string };
      initialData: { coParents: unknown[]; invites: unknown[] };
    };
    profile: { initialData: { locale: string } | null };
  }>({
    harness,
    route: Route,
    params: { publicId: baby.publicId },
  });

  expect(result.managerBaby).toMatchObject({
    input: { babyId: baby.publicId },
    initialData: { name: "Baby Smith" },
  });
  expect(result.coParentsList).toMatchObject({
    input: { babyId: baby.publicId },
    initialData: { coParents: [], invites: [] },
  });
  expect(result.profile?.initialData?.locale).toBeTruthy();
});

test("settings loader redirects non-managers to the public baby page", async () => {
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
    babyId: baby.babyId,
    name: "Final Name",
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
      to: "/baby/$publicId/settings",
      params: { publicId: renamed?.publicId },
      replace: true,
    },
  });
});

test("beforeLoad allows matching public ids", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await expect(
    runRouteBeforeLoad({
      harness,
      route: Route,
      params: { publicId: baby.publicId },
    }),
  ).resolves.toBeUndefined();
});

test("managerDocToBabyData maps manager fields for the settings panel", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const managerDoc = await harness.client.query(api.baby.getManagerBaby, { babyId: baby.publicId });
  if (managerDoc === FORBIDDEN) {
    throw new Error("expected manager baby");
  }

  expect(managerDocToBabyData(managerDoc)).toMatchObject({
    name: "Baby Smith",
    dueDate: "2026-09-01",
    dueDateDisplayMode: "exact",
    publicDueDateText: null,
    theme: null,
    locale: null,
  });
});

test("settings overlay closes to the baby page after the dialog exit animation", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/settings",
    initialEntry: `/baby/${baby.publicId}/settings`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: false },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  fireEvent.click(ctx.view.getByRole("button", { name: "Close" }));

  expect(ctx.back).not.toHaveBeenCalled();
  await vi.waitFor(() => {
    expect(ctx.navigate).toHaveBeenCalledWith({
      to: "/baby/$publicId",
      params: { publicId: baby.publicId },
      replace: true,
      resetScroll: false,
    });
  });
});

test("settings overlay prefers history.back when opened via push", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/settings",
    initialEntry: `/baby/${baby.publicId}/settings`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: true },
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

test("settings overlay persists baby name edits through Convex", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: ownerId });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/settings",
    initialEntry: `/baby/${baby.publicId}/settings`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: false },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });

  fireEvent.click(htmlButton(ctx.view.getAllByRole("button", { name: "Edit" })[0]));
  fireEvent.change(ctx.view.getByLabelText("Baby name"), { target: { value: "Nova Rae" } });
  fireEvent.click(ctx.view.getByRole("button", { name: "Save" }));

  await vi.waitFor(async () => {
    const managerDoc = await harness.client.query(api.baby.getManagerBaby, {
      babyId: baby.publicId,
    });
    if (managerDoc === FORBIDDEN) {
      throw new Error("expected manager baby");
    }
    expect(managerDoc.name).toBe("Nova Rae");
  });
});

test("settings overlay hides delete for co-parents", async () => {
  await using harness = await createConvexTestHarness({ identity: null });
  const ownerId = await signUpTestUser(harness, {
    email: "owner@example.com",
    password: "password123",
    name: "Owner",
  });
  harness.withIdentity({ subject: ownerId });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });
  const bobId = await signUpTestUser(harness, {
    email: "bob@example.com",
    password: "password123",
    name: "Bob",
  });
  await harness.client.mutation(api.coParents.invite, {
    babyId: baby.babyId,
    email: "bob@example.com",
  });
  harness.withIdentity({ subject: bobId });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/settings",
    initialEntry: `/baby/${baby.publicId}/settings`,
    overlayHistory: { parentEntry: `/baby/${baby.publicId}`, overlayPush: false },
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.queryByText("Delete page")).toBeNull();
});

test("BabySettingsOverlay mounts from the real route loader", async () => {
  await using harness = await createConvexTestHarness({ identity: { subject: "alice" } });
  const baby = await seedOwnedBaby(harness, { name: "Baby Smith", dueDate: "2026-09-01" });

  await using ctx = await renderMountedFileRoute({
    harness,
    route: Route,
    path: "/baby/$publicId/settings",
    initialEntry: `/baby/${baby.publicId}/settings`,
    overlayHistory: null,
    wrap: null,
  });

  await vi.waitFor(() => {
    expect(ctx.view.getByRole("dialog")).toBeTruthy();
  });
  expect(ctx.view.getByRole("heading", { name: "Settings" })).toBeTruthy();
});
