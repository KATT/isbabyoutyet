import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { convexRun, seedHomepageDemoPhotos } from "./seedHomepageDemo";

const convexPackageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const HOMEPAGE_DEMO_PHOTOS_PENDING_MARKER = path.join(
  convexPackageDir,
  ".seed-photos-pending.local",
);

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForConvexReady(extraConvexArgs: string[]) {
  const maxAttempts = 120;
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      convexRun({
        functionName: "homepageDemo:ensureBaby",
        args: {},
        extraConvexArgs,
      });
      return;
    } catch {
      await sleep(1_000);
    }
  }
  throw new Error("Timed out waiting for Convex dev backend before seeding homepage photos");
}

export async function seedHomepagePhotosDeferred() {
  if (!fs.existsSync(HOMEPAGE_DEMO_PHOTOS_PENDING_MARKER)) {
    return;
  }

  console.log("Homepage demo photos pending — waiting for Convex dev backend...");
  await waitForConvexReady([]);
  await seedHomepageDemoPhotos({});
  fs.unlinkSync(HOMEPAGE_DEMO_PHOTOS_PENDING_MARKER);
  console.log("Homepage demo photos seeded.");
}

const isCli = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  await seedHomepagePhotosDeferred();
}
