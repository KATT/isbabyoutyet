import sharp from "sharp";

/** Square crop used on the baby page and timeline. */
export const PAGE_THUMBNAIL = { width: 900, height: 900 } as const;

/**
 * Chromium `Notification.image` (Chrome on Android / Windows). iOS Safari
 * ignores `image`, so the same payload is safe to send everywhere.
 *
 * Android expanded “big picture” is ~450dp wide; at 3× that is 1350px.
 * Chromium crops to ~2:1, so we ship 1350×675 JPEG and keep the subject in
 * the center. Keep the file small (typically well under 200KB) — the image
 * is fetched on the notification’s critical path.
 */
export const PUSH_IMAGE = { width: 1350, height: 675 } as const;

export async function renderPageThumbnail(bytes: Uint8Array) {
  return await sharp(bytes)
    .rotate()
    .resize(PAGE_THUMBNAIL.width, PAGE_THUMBNAIL.height, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 85 })
    .toBuffer();
}

export async function renderPushImage(bytes: Uint8Array) {
  return await sharp(bytes)
    .rotate()
    .resize(PUSH_IMAGE.width, PUSH_IMAGE.height, {
      fit: "cover",
      position: "center",
    })
    .jpeg({ quality: 80 })
    .toBuffer();
}
