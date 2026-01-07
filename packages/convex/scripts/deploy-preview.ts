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

  // Step 1: Deploy Convex first (without build command)
  // --preview-create customizes the deployment name (optional, Convex infers branch name automatically)
  cd(convexPackageDir);

  const deployOutput = await $`npx convex deploy --preview-create ${env.VERCEL_GIT_COMMIT_REF}`;

  // Extract Convex URL from deployment output
  const urlMatch = deployOutput.stdout.match(/https:\/\/[^\s]+\.cloud\.convex\.dev/);
  if (urlMatch) {
    process.env.VITE_CONVEX_URL = urlMatch[0];
    console.log(`Detected Convex URL: ${process.env.VITE_CONVEX_URL}`);
  } else {
    console.warn("Warning: Could not extract Convex URL from deployment output");
  }

  // After deployment, set environment variables in Convex
  await syncEnvVarsToConvex();

  // Step 2: Run build after Convex deployment is complete
  console.log("\n=== Running build ===");
  console.log(`Building web app in: ${webAppDir}`);
  cd(webAppDir);
  await $`pnpm build`;

  // Seed the data
  // Note: Alternatively, you could use --preview-run 'seed:seedPreviewDataPublic'
  // in the deploy command above, which runs automatically for preview deployments
  console.log("Seeding preview data...");
  await $`npx convex run seed:seedPreviewDataPublic`;
} else {
  // Production deployment: regular deploy (no seeding)
  console.log("Deploying Convex to production");
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Web app directory: ${webAppDir}`);
  cd(convexPackageDir);

  // Step 1: Deploy Convex first (without build command)
  const deployOutput = await $`npx convex deploy`;

  // Extract Convex URL from deployment output
  const urlMatch = deployOutput.stdout.match(/https:\/\/[^\s]+\.cloud\.convex\.dev/);
  if (urlMatch) {
    process.env.VITE_CONVEX_URL = urlMatch[0];
    console.log(`Detected Convex URL: ${process.env.VITE_CONVEX_URL}`);
  } else {
    console.warn("Warning: Could not extract Convex URL from deployment output");
  }

  await syncEnvVarsToConvex();

  // Step 2: Run build after Convex deployment is complete
  console.log("\n=== Running build ===");
  console.log(`Building web app in: ${webAppDir}`);
  cd(webAppDir);
  await $`pnpm build`;
}
