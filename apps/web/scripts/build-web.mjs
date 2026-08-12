/**
 * Runs the web app build. Invoked by `convex deploy --cmd` (see
 * deploy-convex.ts), which sets VITE_CONVEX_URL to the deployment URL;
 * the .convex.site URL is derived from it.
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set (expected to be set by `convex deploy --cmd`)");
}

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

// Git-LFS guard: if LFS objects weren't hydrated (e.g. Vercel's Git LFS
// setting is off), imported binaries would be tiny pointer text files and the
// homepage video would ship broken. Fail loudly instead.
const lfsTrackedAssets = ["apps/web/src/assets/how-it-works/how-it-works.mp4"];
for (const asset of lfsTrackedAssets) {
  const head = readFileSync(path.join(workspaceRoot, asset)).subarray(0, 40).toString("utf8");
  if (head.startsWith("version https://git-lfs")) {
    throw new Error(
      `${asset} is an un-hydrated Git LFS pointer. Enable Git LFS for this project ` +
        `(Vercel: Settings → Git → Git LFS) and redeploy, or run \`git lfs pull\` locally.`,
    );
  }
}

const hasDemoLogin =
  process.env.VITE_HAS_DEMO_LOGIN === "true" || process.env.VERCEL_ENV === "preview";

execFileSync("pnpm", ["turbo", "build", "--filter=web"], {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_CONVEX_SITE_URL: convexUrl.replace(".convex.cloud", ".convex.site"),
    // Preview backends are seeded with DEMO_USER — prefill login forms there.
    ...(hasDemoLogin ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
  },
});
