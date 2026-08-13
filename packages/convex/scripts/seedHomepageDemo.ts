import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { HOMEPAGE_DEMO_PHOTO_FILES, HOMEPAGE_DEMO_PHOTO_KEYS } from "../src/homepageDemoFeed";
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

function convexRun(functionName: string, args: unknown, extraConvexArgs: string[]) {
  const result = execFileSync(
    "pnpm",
    ["convex", "run", functionName, JSON.stringify(args), ...extraConvexArgs],
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

async function uploadBytes(
  bytes: Buffer,
  contentType: string,
  extraConvexArgs: string[],
): Promise<string> {
  const uploadUrl = convexRun("homepageDemo:generateUploadUrl", {}, extraConvexArgs);
  if (typeof uploadUrl !== "string") {
    throw new Error(`Expected upload URL string, got ${JSON.stringify(uploadUrl)}`);
  }

  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: { "Content-Type": contentType },
    body: new Uint8Array(bytes),
  });
  if (!response.ok) {
    throw new Error(`Photo upload failed: ${response.status} ${await response.text()}`);
  }
  const payload = (await response.json()) as { storageId?: string };
  if (!payload.storageId) {
    throw new Error(`Upload response missing storageId: ${JSON.stringify(payload)}`);
  }
  return payload.storageId;
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
    const photoId = await uploadBytes(prepared.photo, "image/jpeg", extraConvexArgs);
    const thumbnailId = await uploadBytes(prepared.thumbnail, "image/jpeg", extraConvexArgs);
    photos[photo.key] = { photoId, thumbnailId };
    console.log(`Uploaded ${photo.key} (${photo.filePath})`);
  }

  const result = convexRun("homepageDemo:refresh", { photos }, extraConvexArgs);
  console.log("Homepage demo seeded:", result);
  return result;
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  await seedHomepageDemo({ extraConvexArgs: extraConvexArgsFromArgv(process.argv.slice(2)) });
}
