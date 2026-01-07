#!/usr/bin/env zx

import { $, cd } from "zx";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { convexEnvSchema, envSchema } from "./env";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = envSchema.parse(process.env);
const convexEnv = convexEnvSchema.parse({
  ...env,
  SITE_URL: `https://${env.VERCEL_BRANCH_URL}`,
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

/**
 * Syncs environment variables from process.env to Convex deployment
 * Only syncs variables defined in the env.ts schema
 */
async function syncEnvVarsToConvex() {
  console.log("Setting environment variables in Convex deployment...");

  // Set environment variables in Convex
  // zx automatically handles escaping, so we don't need to manually escape
  cd(convexPackageDir);
  await Promise.all(
    Object.entries(convexEnv).map(async ([key, value]) => {
      await $`npx convex env set ${key} ${value}`;
      console.log(`  ✓ Set ${key}`);
    }),
  );
}

// Determine if this is a preview deployment
// Vercel sets VERCEL_ENV to "preview" for preview deployments
// For local testing, set PREVIEW=true or VERCEL_ENV=preview
const isPreview =
  env.VERCEL_ENV === "preview" || env.VERCEL_ENV === "development" || env.PREVIEW === "true";

if (isPreview) {
  // Preview deployment: use --preview flag
  console.log(`Deploying Convex preview deployment for branch: ${env.VERCEL_GIT_COMMIT_REF}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Web app directory: ${webAppDir}`);

  // For preview deployments, CONVEX_DEPLOY_KEY should be set to a Preview Deploy Key
  // See: https://docs.convex.dev/production/hosting/vercel#preview-deployments
  // The key should be scoped to Preview environment only in Vercel

  // Deploy with preview flag and build command
  // The --cmd-url-env-var-name sets VITE_CONVEX_URL for the build command
  // --preview-create customizes the deployment name (optional, Convex infers branch name automatically)
  cd(convexPackageDir);

  const buildCommand = `cd ${webAppDir} && pnpm build`;
  try {
    await $`npx convex deploy --preview-create ${env.VERCEL_GIT_COMMIT_REF} --cmd ${buildCommand} --cmd-url-env-var-name VITE_CONVEX_URL`;
  } catch (error) {
    console.error("\n=== Deployment failed ===");

    // Check if this is the specific error about production key in preview environment
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorOutput = error instanceof Error ? error.toString() : String(error);
    if (
      (errorMessage.includes("non-production build environment") ||
        errorOutput.includes("non-production build environment")) &&
      (errorMessage.includes("production Convex deployment") ||
        errorOutput.includes("production Convex deployment"))
    ) {
      console.error("\n❌ ERROR: Production Deploy Key detected in preview environment");
      console.error("\nTo fix this issue:");
      console.error("1. Go to your Convex Dashboard → Project Settings");
      console.error("2. Click 'Generate Preview Deploy Key' (NOT Production Deploy Key)");
      console.error("3. Copy the Preview Deploy Key");
      console.error("4. In Vercel → Project Settings → Environment Variables:");
      console.error("   - Set CONVEX_DEPLOY_KEY to your Preview Deploy Key");
      console.error("   - Under 'Environment', uncheck all EXCEPT 'Preview'");
      console.error("   - Save");
      console.error("5. For Production deployments, create a separate CONVEX_DEPLOY_KEY");
      console.error("   scoped ONLY to 'Production' environment with a Production Deploy Key");
      console.error("\nSee: https://docs.convex.dev/production/hosting/vercel#preview-deployments");
    }

    throw error;
  }

  // After deployment, set environment variables in Convex
  // Use VITE_CONVEX_URL that was set by --cmd-url-env-var-name
  await syncEnvVarsToConvex();

  // Seed the data
  // Note: Alternatively, you could use --preview-run 'seed:seedPreviewDataPublic'
  // in the deploy command above, which runs automatically for preview deployments
  console.log("Seeding preview data...");

  try {
    await $`npx convex run seed:seedPreviewDataPublic`;
  } catch (cause) {
    console.warn("Warning: Seed function failed, but deployment succeeded", cause);
  }
} else {
  // Production deployment: regular deploy (no seeding)
  console.log("Deploying Convex to production");
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Web app directory: ${webAppDir}`);
  cd(convexPackageDir);

  const buildCommand = `cd ${webAppDir} && pnpm build`;
  try {
    await $`npx convex deploy --cmd ${buildCommand} --cmd-url-env-var-name VITE_CONVEX_URL`;
    await syncEnvVarsToConvex();
  } catch (error) {
    console.error("\n=== Deployment failed ===");
    throw error;
  }
}
