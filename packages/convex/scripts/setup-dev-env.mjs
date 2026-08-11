/**
 * Idempotent bootstrap for the local (anonymous) Convex dev deployment.
 * Runs as `predev`; a no-op once `.env.local` exists (written by
 * `convex dev --once` when the deployment is first created).
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import webPush from "web-push";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = path.join(packageDir, ".env.local");

if (fs.existsSync(envLocalPath)) {
  process.exit(0);
}

console.log("Setting up the local Convex dev deployment...");

function convex(...args) {
  execFileSync("pnpm", ["convex", ...args], {
    cwd: packageDir,
    stdio: "inherit",
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
  });
}

// Creates the anonymous local deployment, pushes functions, writes .env.local
convex("dev", "--once");

const vapidKeys = webPush.generateVAPIDKeys();
convex("env", "set", "BETTER_AUTH_SECRET", "localhost");
convex("env", "set", "SITE_URL", "http://localhost:3000");
convex("env", "set", "VAPID_PUBLIC_KEY", vapidKeys.publicKey);
convex("env", "set", "VAPID_PRIVATE_KEY", vapidKeys.privateKey);

console.log("✅ Convex dev environment ready");
