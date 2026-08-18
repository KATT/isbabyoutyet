import { convexTest } from "convex-test";
import sharp from "sharp";
import { expect, test } from "vitest";
import { PAGE_THUMBNAIL, PUSH_IMAGE, renderPushImage } from "../src/photoDerivatives";
import { api, internal } from "./_generated/api";
import schema from "./schema";
import { modules, registerComponents } from "./test.setup";

async function jpegBytes(opts: { width: number; height: number }) {
  return await sharp({
    create: {
      width: opts.width,
      height: opts.height,
      channels: 3,
      background: { r: 200, g: 80, b: 40 },
    },
  })
    .jpeg()
    .toBuffer();
}

test("push images are 1350×675 JPEGs (Android big-picture at 3×)", async () => {
  const rendered = await renderPushImage(await jpegBytes({ width: 2000, height: 3000 }));
  const meta = await sharp(rendered).metadata();
  expect(meta.format).toBe("jpeg");
  expect(meta.width).toBe(PUSH_IMAGE.width);
  expect(meta.height).toBe(PUSH_IMAGE.height);
  expect(rendered.byteLength).toBeLessThan(200_000);
});

test("generateThumbnail stores page and push derivatives on the update", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Photo Baby",
    dueDate: "2026-09-01",
  });

  const photo = await t.run(async (ctx) => {
    return await ctx.storage.store(
      new Blob([await jpegBytes({ width: 2000, height: 3000 })], { type: "image/jpeg" }),
    );
  });

  const updateId = await asAlice.mutation(api.updates.post, {
    babyId: created.babyId,
    photoId: photo,
  });

  await t.action(internal.babyThumbnails.generateThumbnail, {
    babyId: created.babyId,
    photoId: photo,
    updateId,
  });

  const stored = await t.run(async (ctx) => {
    const update = await ctx.db.get(updateId);
    if (!update?.thumbnailId || !update.pushImageId) {
      throw new Error("expected generated photo derivatives");
    }
    const thumbnail = await ctx.storage.get(update.thumbnailId);
    const pushImage = await ctx.storage.get(update.pushImageId);
    return {
      thumbnail: thumbnail ? new Uint8Array(await thumbnail.arrayBuffer()) : null,
      pushImage: pushImage ? new Uint8Array(await pushImage.arrayBuffer()) : null,
    };
  });

  const thumbnailMeta = await sharp(stored.thumbnail).metadata();
  expect(thumbnailMeta.width).toBe(PAGE_THUMBNAIL.width);
  expect(thumbnailMeta.height).toBe(PAGE_THUMBNAIL.height);

  const pushMeta = await sharp(stored.pushImage).metadata();
  expect(pushMeta.format).toBe("jpeg");
  expect(pushMeta.width).toBe(PUSH_IMAGE.width);
  expect(pushMeta.height).toBe(PUSH_IMAGE.height);
});

test("send prefers the push image over the original photo", async () => {
  const t = convexTest(schema, modules);
  await registerComponents(t);
  const asAlice = t.withIdentity({ subject: "alice" });
  const created = await asAlice.mutation(api.baby.create, {
    name: "Push Image Baby",
    dueDate: "2026-09-01",
  });

  const original = await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob(["original"], { type: "image/jpeg" }));
  });
  const pushImage = await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob(["push-image"], { type: "image/jpeg" }));
  });
  const updateId = await t.run(async (ctx) => {
    const timelineItemId = await ctx.db.insert("timelineItems", {
      babyId: created.babyId,
      kind: "update",
      postedAt: Date.now(),
    });
    return await ctx.db.insert("updates", {
      babyId: created.babyId,
      timelineItemId,
      photoId: original,
      pushImageId: pushImage,
      postedByUserId: "alice",
    });
  });

  expect(
    await t.query(internal.baby.resolveNotificationImage, {
      updateId,
      photoId: original,
    }),
  ).toBe(pushImage);
  expect(
    await t.query(internal.baby.resolveNotificationImage, {
      updateId: null,
      photoId: original,
    }),
  ).toBe(original);

  const thumbnail = await t.run(async (ctx) => {
    return await ctx.storage.store(new Blob(["thumb"], { type: "image/jpeg" }));
  });
  const thumbnailOnlyUpdateId = await t.run(async (ctx) => {
    const timelineItemId = await ctx.db.insert("timelineItems", {
      babyId: created.babyId,
      kind: "update",
      postedAt: Date.now(),
    });
    return await ctx.db.insert("updates", {
      babyId: created.babyId,
      timelineItemId,
      photoId: original,
      thumbnailId: thumbnail,
    });
  });
  expect(
    await t.query(internal.baby.resolveNotificationImage, {
      updateId: thumbnailOnlyUpdateId,
      photoId: original,
    }),
  ).toBe(thumbnail);
});
