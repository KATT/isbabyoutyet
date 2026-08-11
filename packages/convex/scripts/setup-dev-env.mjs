/**
 * Idempotent bootstrap for the local (anonymous) Convex dev deployment.
 *
 * - First run (no `.env.local`): create the deployment, set env vars
 * - Every run: ensure the local test user + sample babies exist
 *   (matches the DEV defaults on the login form: test@example.com / password)
 *
 * Seeding goes through `convex run` (not HTTP), because `convex dev --once`
 * does not leave the site-proxy on :3211 running.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import webPush from "web-push";

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const envLocalPath = path.join(packageDir, ".env.local");

function convex(...args) {
  execFileSync("pnpm", ["convex", ...args], {
    cwd: packageDir,
    stdio: "inherit",
    env: { ...process.env, CONVEX_AGENT_MODE: "anonymous" },
  });
}

if (!fs.existsSync(envLocalPath)) {
  console.log("Setting up the local Convex dev deployment...");

  // Creates the anonymous local deployment, pushes functions, writes .env.local
  convex("dev", "--once");

  const vapidKeys = webPush.generateVAPIDKeys();
  convex("env", "set", "BETTER_AUTH_SECRET", "localhost-dev-secret-min-32-chars!!");
  convex("env", "set", "SITE_URL", "http://localhost:3000");
  convex("env", "set", "VAPID_PUBLIC_KEY", vapidKeys.publicKey);
  convex("env", "set", "VAPID_PRIVATE_KEY", vapidKeys.privateKey);
}

console.log("Seeding local test user (test@example.com / password)...");
convex("run", "seed:seedLocalDev");

console.log("✅ Convex dev environment ready");
