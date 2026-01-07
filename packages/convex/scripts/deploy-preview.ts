#!/usr/bin/env zx

import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { $, cd } from "zx";
import { convexEnvSchema, envSchema } from "../src/env";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = envSchema.parse(process.env);

// Determine the site URL for Convex backend
// For preview: use VERCEL_BRANCH_URL
// For production: use VERCEL_URL (available in all Vercel environments)
const siteUrl =
  env.VERCEL_ENV === "preview"
    ? `https://${env.VERCEL_BRANCH_URL}`
    : `https://${process.env.VERCEL_URL || "localhost:3000"}`;

const convexEnv = convexEnvSchema.parse({
  ...env,
  SITE_URL: siteUrl,
});

// Resolve the web app directory relative to the convex package
// This script is in packages/convex/scripts/
// Web app is in apps/web/
const convexPackageDir = resolve(__dirname, "..");
const workspaceRoot = resolve(convexPackageDir, "../..");
const webAppDir = join(workspaceRoot, "apps", "web");

// Validate directories exist
if (!existsSync(webAppDir)) {
  console.error(`Error: Web app directory does not exist: ${webAppDir}`);
  process.exit(1);
}

if (!existsSync(convexPackageDir)) {
  console.error(`Error: Convex package directory does not exist: ${convexPackageDir}`);
  process.exit(1);
}

async function syncEnvVarsToConvex() {
  console.log("Setting environment variables in Convex deployment...");
  cd(convexPackageDir);
  await Promise.all(
    Object.entries(convexEnv).map(async ([key, value]) => {
      await $`npx convex env set ${key} ${value}`;
      console.log(`  ✓ Set ${key}`);
    }),
  );
}

async function handleZodError<T>(promise: Promise<T>) {
  try {
    return await promise;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Uncaught ZodError:")) {
      console.log(`Unexpected ZodError (expected on first deployment):`, error);
    } else {
      throw error;
    }
  }
}

const cmds: Record<typeof env.VERCEL_ENV, () => Promise<void>> = {
  production: async () => {
    cd(convexPackageDir);
    await handleZodError(
      $`npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd "cd ${webAppDir} && pnpm build"`,
    );
    await syncEnvVarsToConvex();
  },
  development: async () => {
    throw new Error("Development deployment is not supported");
  },
  preview: async () => {
    // Preview deployment: use --preview flag
    console.log(`Deploying Convex preview deployment for branch: ${env.VERCEL_GIT_COMMIT_REF}`);
    console.log(`Working directory: ${process.cwd()}`);
    console.log(`Web app directory: ${webAppDir}`);

    // For preview deployments, CONVEX_DEPLOY_KEY should be set to a Preview Deploy Key
    // See: https://docs.convex.dev/production/hosting/vercel#preview-deployments
    // The key should be scoped to Preview environment only in Vercel

    // Step 1: Deploy Convex first (without build command)
    // --preview-create customizes the deployment name (optional, Convex infers branch name automatically)
    cd(convexPackageDir);

    await handleZodError(
      $`npx convex deploy --preview-create ${env.VERCEL_GIT_COMMIT_REF} --cmd-url-env-var-name VITE_CONVEX_URL --cmd "echo VITE_CONVEX_URL=$VITE_CONVEX_URL"`,
    );

    console.log("Setting environment variables in Convex deployment...");
    cd(convexPackageDir);
    for (const [key, value] of Object.entries(convexEnv)) {
      await $`npx convex env set ${key} ${value} --preview-name ${env.VERCEL_GIT_COMMIT_REF}`;
    }
    // Seed the data
    // Note: Alternatively, you could use --preview-run 'seed:seedPreviewDataPublic'
    // in the deploy command above, which runs automatically for preview deployments
    console.log("Seeding preview data...");
    await $`npx convex run seed:seedPreviewData --preview-name ${env.VERCEL_GIT_COMMIT_REF} --push`;
  },
};

await cmds[env.VERCEL_ENV]();
