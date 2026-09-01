import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { renderBlurDataUrl, renderPageThumbnail, renderPushImage } from "../src/photoDerivatives";
import {
  HOMEPAGE_DEMO_PHOTO_FILES,
  HOMEPAGE_DEMO_PHOTO_KEYS,
  homepageDemoLocales,
} from "../src/homepageDemoFeed";
import type { HomepageDemoPhotoKey } from "../src/homepageDemoFeed";
import { isConvexPreviewWithoutFunctions } from "../src/previewDeploy";
import {
  isJsonObjectValue,
  parseJsonBoolean,
  parseJsonString,
  type JsonValue,
} from "@workspace/runtime/json";
import * as z from "zod";

const LFS_POINTER_PREFIX = "version https://git-lfs.github.com/spec/v1";
const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const convexPackageDir = path.resolve(scriptsDir, "..");
const assetsDir = path.join(convexPackageDir, "assets/homepage-demo");

type UploadedPhotos = Record<
  HomepageDemoPhotoKey,
  { photoId: string; thumbnailId: string; pushImageId: string; blurDataUrl: string }
>;

export function extraConvexArgsFromArgv(argv: string[]) {
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

export function convexRun(opts: {
  functionName: string;
  args: unknown;
  extraConvexArgs: string[];
}) {
  const result = execFileSync(
    "pnpm",
    ["convex", "run", opts.functionName, JSON.stringify(opts.args), ...opts.extraConvexArgs],
    { cwd: convexPackageDir, encoding: "utf8", env: process.env },
  );
  return parseConvexRunOutput(result);
}

function parseConvexRunOutput(stdout: string): JsonValue {
  const trimmed = stdout.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const lines = trimmed.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
      const line = lines[i]?.trim();
      if (!line) continue;
      try {
        return JSON.parse(line);
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

async function jpegAndDerivatives(buffer: Buffer) {
  const photo = await sharp(buffer)
    .rotate()
    .resize({ width: 1600, height: 1600, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 })
    .toBuffer();
  const thumbnail = await renderPageThumbnail(buffer);
  const pushImage = await renderPushImage(buffer);
  const blurDataUrl = await renderBlurDataUrl(buffer);
  return { photo, thumbnail, pushImage, blurDataUrl };
}

function isLoopbackUploadUrl(uploadUrl: string) {
  const hostname = new URL(uploadUrl).hostname;
  return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
}

/**
 * Cloud (Vercel/prod): POST to the upload URL. Local anonymous backends die
 * when `convex run` exits, so the URL's 127.0.0.1:3210 is gone — store bytes
 * through `storePhoto` instead. That path cannot be used on Linux/Vercel:
 * resized JPEGs exceed Linux MAX_ARG_STRLEN (~128KiB) as a `convex run` argv.
 */
async function uploadBytes(opts: { bytes: Buffer; extraConvexArgs: string[] }) {
  const uploadUrl = parseJsonString(
    convexRun({
      functionName: "homepageDemo:generateUploadUrl",
      args: {},
      extraConvexArgs: opts.extraConvexArgs,
    }),
  );
  if (uploadUrl === null) {
    throw new Error(`Expected upload URL string, got invalid convex run output`);
  }

  if (isLoopbackUploadUrl(uploadUrl)) {
    const storageId = parseJsonString(
      convexRun({
        functionName: "homepageDemo:storePhoto",
        args: {
          bytes: { $bytes: opts.bytes.toString("base64") },
          contentType: "image/jpeg",
        },
        extraConvexArgs: opts.extraConvexArgs,
      }),
    );
    if (storageId === null) {
      throw new Error(`Expected storage id string, got invalid convex run output`);
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
  const payload: JsonValue = await response.json();
  if (!isJsonObjectValue(payload) || !("storageId" in payload)) {
    throw new Error(`Upload response missing storageId: ${JSON.stringify(payload)}`);
  }
  const storageId = parseJsonString(payload.storageId);
  if (storageId === null || !storageId) {
    throw new Error(`Upload response missing storageId: ${JSON.stringify(payload)}`);
  }
  return storageId;
}

function hasAllHomepageDemoPhotos(photos: Partial<UploadedPhotos>): photos is UploadedPhotos {
  return HOMEPAGE_DEMO_PHOTO_KEYS.every((key) => photos[key] !== undefined);
}

function refreshHomepageDemoLocales(opts: {
  extraConvexArgs: string[];
  photos: UploadedPhotos | null;
}) {
  const results = [];
  for (const locale of homepageDemoLocales()) {
    const args = opts.photos ? { photos: opts.photos, locale } : { locale };
    const result = convexRun({
      functionName: "homepageDemo:refresh",
      args,
      extraConvexArgs: opts.extraConvexArgs,
    });
    console.log(`Homepage demo seeded (${locale}):`, result);
    results.push(result);
  }
  return results;
}

const execFileErrorSchema = z.object({
  message: z.string(),
  stdout: z.union([z.string(), z.null()]).optional(),
  stderr: z.union([z.string(), z.null()]).optional(),
});

function execFileErrorOutput(error: z.infer<typeof execFileErrorSchema>) {
  return `${error.message}\n${error.stdout ?? ""}\n${error.stderr ?? ""}`;
}

function skipSeedWhenPreviewHasNoFunctions(cause: unknown) {
  const parsed = execFileErrorSchema.safeParse(cause);
  if (!parsed.success || !isConvexPreviewWithoutFunctions(execFileErrorOutput(parsed.data))) {
    throw cause;
  }
  console.log(
    "Convex preview has no functions — skipping photo seed (merge-queue skip or missing preview)",
  );
}

function hasCompleteHomepageDemoPhotoSet(extraConvexArgs: string[]) {
  const result = parseJsonBoolean(
    convexRun({
      functionName: "homepageDemo:hasCompletePhotoSet",
      args: {},
      extraConvexArgs,
    }),
  );
  if (result === null) {
    throw new Error(`Expected homepage photo sentinel boolean, got invalid convex run output`);
  }
  return result;
}

/** Fixture babies + timeline text only — no sharp work or storage uploads. */
export async function seedHomepageDemoContent(opts: { extraConvexArgs?: string[] }) {
  const extraConvexArgs = opts.extraConvexArgs ?? [];
  return refreshHomepageDemoLocales({ extraConvexArgs, photos: null });
}

async function loadPhotosFromDisk() {
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

  return photosOnDisk;
}

async function uploadHomepageDemoPhotos(opts: { extraConvexArgs: string[] }) {
  const photosOnDisk = await loadPhotosFromDisk();

  const photos: Partial<UploadedPhotos> = {};

  for (const photo of photosOnDisk) {
    const prepared = await jpegAndDerivatives(photo.buffer);
    const photoId = await uploadBytes({
      bytes: prepared.photo,
      extraConvexArgs: opts.extraConvexArgs,
    });
    const thumbnailId = await uploadBytes({
      bytes: prepared.thumbnail,
      extraConvexArgs: opts.extraConvexArgs,
    });
    const pushImageId = await uploadBytes({
      bytes: prepared.pushImage,
      extraConvexArgs: opts.extraConvexArgs,
    });
    photos[photo.key] = { photoId, thumbnailId, pushImageId, blurDataUrl: prepared.blurDataUrl };
    console.log(`Uploaded ${photo.key} (${photo.filePath})`);
  }

  if (!hasAllHomepageDemoPhotos(photos)) {
    throw new Error("Not all homepage demo photos were uploaded");
  }
  return photos;
}

/** Resize, upload, and attach homepage demo photos to every locale baby. */
export async function seedHomepageDemoPhotos(opts: { extraConvexArgs?: string[] }) {
  const extraConvexArgs = opts.extraConvexArgs ?? [];
  try {
    if (hasCompleteHomepageDemoPhotoSet(extraConvexArgs)) {
      console.log("Homepage demo photos already stored — skipping uploads.");
      return [];
    }
  } catch (error) {
    skipSeedWhenPreviewHasNoFunctions(error);
    return [];
  }
  const photos = await uploadHomepageDemoPhotos({ extraConvexArgs });
  return refreshHomepageDemoLocales({ extraConvexArgs, photos });
}

export async function seedHomepageDemo(opts: { extraConvexArgs?: string[] }) {
  const extraConvexArgs = opts.extraConvexArgs ?? [];
  try {
    if (hasCompleteHomepageDemoPhotoSet(extraConvexArgs)) {
      console.log("Homepage demo already initialized — daily cron handles resets.");
      return [];
    }
  } catch (error) {
    skipSeedWhenPreviewHasNoFunctions(error);
    return [];
  }
  await seedHomepageDemoContent({ extraConvexArgs });
  return await seedHomepageDemoPhotos({ extraConvexArgs });
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  const cliArgs = process.argv.slice(2);
  const extraConvexArgs = extraConvexArgsFromArgv(cliArgs);
  const modeFlags = cliArgs.filter((arg) => arg.startsWith("--"));
  const contentOnly = modeFlags.includes("--content-only");
  const photosOnly = modeFlags.includes("--photos-only");

  if (contentOnly && photosOnly) {
    throw new Error("Use only one of --content-only or --photos-only");
  }

  if (contentOnly) {
    await seedHomepageDemoContent({ extraConvexArgs });
  } else if (photosOnly) {
    await seedHomepageDemoPhotos({ extraConvexArgs });
  } else {
    await seedHomepageDemo({ extraConvexArgs });
  }
}
