import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import {
  HOMEPAGE_DEMO_PHOTO_FILES,
  HOMEPAGE_DEMO_PHOTO_KEYS,
  homepageDemoLocales,
} from "../src/homepageDemoFeed";
import type { HomepageDemoPhotoKey } from "../src/homepageDemoFeed";

const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const convexPackageDir = path.resolve(scriptsDir, "..");
const assetsDir = path.join(convexPackageDir, "assets/homepage-demo");

function extraConvexArgsFromArgv(argv: string[]) {
  const extra: string[] = [];
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const value = argv[i + 1];
    if (flag === "--preview-name" && value) {
      extra.push("--preview-name", value);
      i++;
    }
  }
  return extra;
}

function convexRun(opts: { functionName: string; args: unknown; extraConvexArgs: string[] }) {
  const result = execFileSync(
    "pnpm",
    ["convex", "run", opts.functionName, JSON.stringify(opts.args), ...opts.extraConvexArgs],
    { cwd: convexPackageDir, encoding: "utf8", env: process.env },
  );
  return parseConvexRunOutput(result);
}

function parseConvexRunOutput(stdout: string) {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch {
    const lines = trimmed.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      try {
        return JSON.parse(line) as unknown;
      } catch {
        // keep looking
      }
    }
    throw new Error(`Could not parse convex run output:\n${stdout}`);
  }
}

function isLfsPointer(buffer: Buffer) {
  return buffer.subarray(0, LFS_POINTER_PREFIX.length).toString("utf8") === LFS_POINTER_PREFIX;
}

function pullLfsFiles() {
  console.log("Git LFS pointer files detected — running git lfs pull");
  execFileSync("git", ["lfs", "pull", "--include", "packages/convex/assets/homepage-demo/**"], {
    cwd: path.resolve(convexPackageDir, "../.."),
    stdio: "inherit",
  });
}

function readPhotoBuffer(filename: string) {
  const filePath = path.join(assetsDir, filename);
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing homepage demo photo: ${filePath}`);
  }
  return { filePath, buffer: fs.readFileSync(filePath) };
}

async function jpegAndThumbnail(buffer: Buffer) {
  const photo = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const thumbnail = await sharp(buffer)
    .rotate()
    .resize(900, 900, { fit: "cover", position: "center" })
    .jpeg({ quality: 85 })
    .toBuffer();
  return { photo, thumbnail };
}

const UPLOAD_ATTEMPTS = 5;
const UPLOAD_RETRY_DELAY_MS = 500;

function isLoopbackUploadUrl(uploadUrl: string) {
  const hostname = new URL(uploadUrl).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

function errorCode(error: unknown) {
  if (typeof error !== "object" || error === null || !("code" in error)) {
    return null;
  }
  return typeof error.code === "string" ? error.code : null;
}

function isTransientUploadError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  const codes = [errorCode(error), error.cause ? errorCode(error.cause) : null];
  if (
    codes.includes("ECONNRESET") ||
    codes.includes("ETIMEDOUT") ||
    codes.includes("EPIPE") ||
    codes.includes("UND_ERR_SOCKET") ||
    codes.includes("UND_ERR_CONNECT_TIMEOUT")
  ) {
    return true;
  }
  if (error.message.includes("fetch failed") || error.message.includes("ECONNRESET")) {
    return true;
  }
  return /^Photo upload failed: (408|429|5\d\d)\b/.test(error.message);
}

/**
 * Cloud (Vercel/prod): POST to the upload URL. Local anonymous backends die
 * when `convex run` exits, so the URL's 127.0.0.1:3210 is gone — store bytes
 * through `storePhoto` instead. That path cannot be used on Linux/Vercel:
 * resized JPEGs exceed Linux MAX_ARG_STRLEN (~128KiB) as a `convex run` argv.
 *
 * Vercel preview builds hit `TypeError: fetch failed` / `ECONNRESET` against
 * Convex storage; mint a fresh upload URL and retry those transient failures.
 */
async function uploadBytesOnce(opts: { bytes: Buffer; extraConvexArgs: string[] }) {
  const uploadUrl = convexRun({
    functionName: "homepageDemo:generateUploadUrl",
    args: {},
    extraConvexArgs: opts.extraConvexArgs,
  });
  if (typeof uploadUrl !== "string") {
    throw new Error(`Expected upload URL string, got ${JSON.stringify(uploadUrl)}`);
  }

  if (isLoopbackUploadUrl(uploadUrl)) {
    const storageId = convexRun({
      functionName: "homepageDemo:storePhoto",
      args: {
        bytes: { $bytes: opts.bytes.toString("base64") },
        contentType: "image/jpeg",
      },
      extraConvexArgs: opts.extraConvexArgs,
    });
    if (typeof storageId !== "string") {
      throw new Error(`Expected storage id string, got ${JSON.stringify(storageId)}`);
    }
    return storageId;
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": "image/jpeg" },
    body: new Uint8Array(opts.bytes),
  });
  if (!response.ok) {
    throw new Error(`Photo upload failed: ${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as { storageId: string | undefined };
  if (!payload.storageId) {
    throw new Error(`Upload response missing storageId: ${JSON.stringify(payload)}`);
  }
  return payload.storageId;
}

async function uploadBytes(opts: { bytes: Buffer; extraConvexArgs: string[] }) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt += 1) {
    try {
      return await uploadBytesOnce(opts);
    } catch (error) {
      lastError = error;
      if (!isTransientUploadError(error) || attempt === UPLOAD_ATTEMPTS) {
        throw error;
      }
      const delayMs = UPLOAD_RETRY_DELAY_MS * attempt;
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `Photo upload failed (attempt ${attempt}/${UPLOAD_ATTEMPTS}): ${message}. Retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

export async function seedHomepageDemo(opts: { extraConvexArgs?: string[] }) {
  const extraConvexArgs = opts.extraConvexArgs ?? [];

  let photosOnDisk = HOMEPAGE_DEMO_PHOTO_KEYS.map((key) => ({
    key,
    ...readPhotoBuffer(HOMEPAGE_DEMO_PHOTO_FILES[key]),
  }));

  if (photosOnDisk.some((photo) => isLfsPointer(photo.buffer))) {
    pullLfsFiles();
    photosOnDisk = HOMEPAGE_DEMO_PHOTO_KEYS.map((key) => ({
      key,
      ...readPhotoBuffer(HOMEPAGE_DEMO_PHOTO_FILES[key]),
    }));
  }

  if (photosOnDisk.some((photo) => isLfsPointer(photo.buffer))) {
    throw new Error(
      "Homepage demo photos are still Git LFS pointers. Enable Git LFS for this checkout (Vercel: Project Settings → Git → Git LFS) and retry.",
    );
  }

  const photos: Record<HomepageDemoPhotoKey, { photoId: string; thumbnailId: string }> =
    {} as Record<HomepageDemoPhotoKey, { photoId: string; thumbnailId: string }>;

  for (const photo of photosOnDisk) {
    const prepared = await jpegAndThumbnail(photo.buffer);
    const photoId = await uploadBytes({
      bytes: prepared.photo,
      extraConvexArgs,
    });
    const thumbnailId = await uploadBytes({
      bytes: prepared.thumbnail,
      extraConvexArgs,
    });
    photos[photo.key] = { photoId, thumbnailId };
    console.log(`Uploaded ${photo.key} (${photo.filePath})`);
  }

  const results = [];
  for (const locale of homepageDemoLocales()) {
    const result = convexRun({
      functionName: "homepageDemo:refresh",
      args: { photos, locale },
      extraConvexArgs,
    });
    console.log(`Homepage demo seeded (${locale}):`, result);
    results.push(result);
  }
  return results;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  await seedHomepageDemo({ extraConvexArgs: extraConvexArgsFromArgv(process.argv.slice(2)) });
}
