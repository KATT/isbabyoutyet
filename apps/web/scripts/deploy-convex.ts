#!/usr/bin/env tsx
/**
 * Vercel build command (see vercel.json): deploys the Convex backend and
 * builds the web app, following the canonical Convex + Vercel setup:
 * https://docs.convex.dev/production/hosting/vercel
 *
 * 1. `convex deploy` pushes functions and runs the web build via `--cmd`,
 *    with the deployment URL exposed as VITE_CONVEX_URL. On Vercel it
 *    automatically targets production or a per-branch preview deployment
 *    based on the CONVEX_DEPLOY_KEY, and `--preview-run` seeds fresh
 *    preview backends with the demo login + babies (ignored in production).
 * 2. Runtime environment variables are synced to the Convex deployment.
 *    Tip: most of these can instead be configured once as project "default
 *    environment variables" in the Convex dashboard; SITE_URL is the only
 *    per-preview value.
 * 3. Pending migrations are run.
 */
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { convexEnvSchema } from "@workspace/convex/src/env";
import * as z from "zod";

const vercelEnvSchema = z.object({
  VERCEL_ENV: z.enum(["production", "preview"]),
  VERCEL_GIT_COMMIT_REF: z.string().min(1), // The git branch of the commit
  VERCEL_BRANCH_URL: z.string().min(1), // The domain name of the Git branch URL
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1), // The domain name of the production project URL

  BETTER_AUTH_SECRET: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@isbabyoutyet.com"),
});

const env = vercelEnvSchema.parse(process.env);
const isPreview = env.VERCEL_ENV === "preview";

const siteUrl = isPreview
  ? `https://${env.VERCEL_BRANCH_URL}`
  : `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;

const convexEnv = convexEnvSchema.parse({ ...env, SITE_URL: siteUrl });

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const convexPackageDir = path.resolve(scriptsDir, "../../../packages/convex");

function runInConvexPackage(command: string, args: string[]) {
  console.log(`\n$ ${command} ${args.join(" ")}`);
  execFileSync("pnpm", ["exec", command, ...args], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_SITE_URL: siteUrl,
      // Bake demo-login prefills into the web build on preview only.
      ...(isPreview ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
    },
  });
}

function convexCli(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  execFileSync("pnpm", ["convex", ...args], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: {
      ...process.env,
      VITE_SITE_URL: siteUrl,
      // Bake demo-login prefills into the web build on preview only.
      ...(isPreview ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
    },
  });
}

// Refresh Confect → Convex codegen so deploy always ships a consistent
// convex/ tree (even if a local edit forgot to run `confect codegen`).
runInConvexPackage("confect", ["codegen"]);

convexCli([
  "deploy",
  "--cmd-url-env-var-name",
  "VITE_CONVEX_URL",
  "--cmd",
  "node ../../apps/web/scripts/build-web.mjs",
  ...(isPreview ? ["--preview-run", "seed:seedDemoData"] : []),
]);

// `convex deploy` infers the preview name from the git branch; the other
// commands need it passed explicitly.
const previewArgs = isPreview ? ["--preview-name", env.VERCEL_GIT_COMMIT_REF] : [];

for (const [key, value] of Object.entries(convexEnv)) {
  convexCli(["env", "set", key, value, ...previewArgs]);
}

convexCli(["run", "migrations:runAll", ...previewArgs]);
