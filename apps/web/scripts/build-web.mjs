/**
 * Runs the web app build. Invoked by `convex deploy --cmd` (see
 * deploy-convex.ts), which sets VITE_CONVEX_URL to the deployment URL;
 * the .convex.site URL is derived from it.
 */
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) {
  throw new Error("VITE_CONVEX_URL is not set (expected to be set by `convex deploy --cmd`)");
}

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

execFileSync("pnpm", ["turbo", "build", "--filter=web"], {
  cwd: workspaceRoot,
  stdio: "inherit",
  env: {
    ...process.env,
    VITE_CONVEX_SITE_URL: convexUrl.replace(".convex.cloud", ".convex.site"),
    // Preview backends are seeded with DEMO_USER — prefill login forms there.
    ...(process.env.VERCEL_ENV === "preview" ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
  },
});
