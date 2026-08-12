import { convexTest } from "convex-test";
import { expect, test, vi } from "vitest";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

vi.mock("sharp", () => ({
  default: vi.fn(() => ({
    resize: vi.fn().mockReturnThis(),
    jpeg: vi.fn().mockReturnThis(),
    toBuffer: vi.fn(async () => new Uint8Array([1, 2, 3])),
  })),
}));

test("generateThumbnail resizes the photo and stores the thumbnail id on the baby", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });
  const photoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["raw-photo"])));

  const thumbnailId = await t.action(internal.babyThumbnails.generateThumbnail, {
    babyId: created.babyId,
    photoId,
  });

  const baby = await t.query(api.baby.getByPublicId, { id: created.publicId });
  expect(baby).toMatchObject({ thumbnailId });

  const thumbnailExists = await t.run(async (ctx) => {
    return (await ctx.storage.get(thumbnailId)) !== null;
  });
  expect(thumbnailExists).toBe(true);
});

test("generateThumbnail throws when the photo is missing from storage", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });

  const created = await asAlice.mutation(api.baby.create, {
    name: "Baby",
    dueDate: "2026-09-01",
  });
  const photoId = await t.run(async (ctx) => await ctx.storage.store(new Blob(["photo"])));
  await t.run(async (ctx) => await ctx.storage.delete(photoId));

  await expect(
    t.action(internal.babyThumbnails.generateThumbnail, { babyId: created.babyId, photoId }),
  ).rejects.toThrow("Photo not found in storage");
});
