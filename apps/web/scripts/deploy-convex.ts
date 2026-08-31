#!/usr/bin/env tsx
/**
 * Vercel build command (see vercel.json): deploys the Convex backend and
 * builds the web app, following the canonical Convex + Vercel setup:
 * https://docs.convex.dev/production/hosting/vercel
 *
 * 1. `convex deploy` pushes functions and runs the web build via `--cmd`,
 *    with the deployment URL exposed as VITE_CONVEX_URL. On Vercel it
 *    automatically targets production or a per-branch preview deployment
 *    based on the CONVEX_DEPLOY_KEY. Preview backends are wiped with
 *    `--preview-create` only when `schema.ts` / `convex.config.ts` change
 *    (fingerprint stored as PREVIEW_SCHEMA_FINGERPRINT). Otherwise
 *    `--preview-name` reuses the branch backend so deploys skip seed and
 *    photo uploads. `--preview-run` reseeds demo login on a fresh backend
 *    (ignored in production).
 * 2. Runtime environment variables are synced to the Convex deployment.
 *    Tip: most of these can instead be configured once as project "default
 *    environment variables" in the Convex dashboard; SITE_URL is the only
 *    per-preview value.
 * 3. Pending migrations are run.
 * 4. Production bootstraps homepage demos in-band. Preview wipes seed
 *    fixture text during the build; homepage photos run from GitHub Actions
 *    after the Vercel deployment is Ready (`seed-preview.yml`).
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { convexEnvSchema } from "@workspace/convex/src/env";
import {
  SCHEMA_FINGERPRINT_ENV,
  SCHEMA_FINGERPRINT_RELATIVE_PATHS,
  computeSchemaFingerprint,
  parseEnvGetOutput,
  previewDeployCliArgs,
  shouldRecreatePreview,
} from "@workspace/convex/src/previewDeploy";
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

function convexDeployEnv() {
  const baseEnv = {
    ...process.env,
    VITE_SITE_URL: siteUrl,
  };
  if (!isPreview) {
    return baseEnv;
  }
  return {
    ...baseEnv,
    VITE_HAS_DEMO_LOGIN: "true",
  };
}

function convexCli(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  execFileSync("pnpm", ["convex", ...args], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: convexDeployEnv(),
  });
}

function convexCliOutput(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  return execFileSync("pnpm", ["convex", ...args], {
    cwd: convexPackageDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: convexDeployEnv(),
  });
}

function readCurrentSchemaFingerprint() {
  const files = SCHEMA_FINGERPRINT_RELATIVE_PATHS.map((relativePath) => ({
    path: relativePath,
    contents: fs.readFileSync(path.join(convexPackageDir, relativePath), "utf8"),
  }));
  return computeSchemaFingerprint(files);
}

function readStoredSchemaFingerprint(previewName: string) {
  try {
    return parseEnvGetOutput(
      convexCliOutput(["env", "get", SCHEMA_FINGERPRINT_ENV, "--preview-name", previewName]),
    );
  } catch {
    return null;
  }
}

const currentFingerprint = readCurrentSchemaFingerprint();
const recreatePreview =
  isPreview &&
  shouldRecreatePreview(readStoredSchemaFingerprint(env.VERCEL_GIT_COMMIT_REF), currentFingerprint);

if (isPreview) {
  if (recreatePreview) {
    console.log(
      `\nSchema changed or preview is new — recreating Convex preview "${env.VERCEL_GIT_COMMIT_REF}"`,
    );
  } else {
    console.log(`\nSchema unchanged — reusing Convex preview "${env.VERCEL_GIT_COMMIT_REF}"`);
  }
}

convexCli([
  "deploy",
  "--cmd-url-env-var-name",
  "VITE_CONVEX_URL",
  "--cmd",
  "node ../../apps/web/scripts/build-web.mjs",
  ...(isPreview ? previewDeployCliArgs(env.VERCEL_GIT_COMMIT_REF, recreatePreview) : []),
]);

// `convex deploy` infers the preview name from the git branch; the other
// commands need it passed explicitly.
const previewArgs = isPreview ? ["--preview-name", env.VERCEL_GIT_COMMIT_REF] : [];

for (const [key, value] of Object.entries(convexEnv)) {
  convexCli(["env", "set", key, value, ...previewArgs]);
}

if (isPreview) {
  convexCli(["env", "set", SCHEMA_FINGERPRINT_ENV, currentFingerprint, ...previewArgs]);
}

convexCli(["run", "migrations:runAll", ...previewArgs]);

const migrationStatusSchema = z.object({
  isDone: z.boolean(),
  failed: z.array(z.string()),
});

for (let attempt = 0; attempt < 300; attempt += 1) {
  const status = migrationStatusSchema.parse(
    JSON.parse(convexCliOutput(["run", "migrations:deploymentStatus", ...previewArgs])),
  );
  if (status.failed.length > 0) {
    throw new Error(`Migration failed: ${status.failed.join("; ")}`);
  }
  if (status.isDone) {
    break;
  }
  if (attempt === 299) {
    throw new Error("Migrations did not finish before the deployment deadline");
  }
  await new Promise((resolve) => setTimeout(resolve, 1_000));
}

if (!isPreview) {
  console.log("\n$ pnpm seed:homepage");
  execFileSync("pnpm", ["run", "seed:homepage", "--", ...previewArgs], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: process.env,
  });
} else if (recreatePreview) {
  console.log("\n$ pnpm seed:homepage:content");
  execFileSync("pnpm", ["run", "seed:homepage:content", "--", ...previewArgs], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: process.env,
  });
}
