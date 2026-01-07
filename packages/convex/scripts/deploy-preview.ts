#!/usr/bin/env zx

import { $, cd } from "zx";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync, writeFileSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { convexEnvSchema, envSchema } from "../src/env";

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
 * Creates a temporary .env file with Convex environment variables
 * Returns the path to the temporary file
 */
function createTempEnvFile(): string {
  const envFileContent = Object.entries(convexEnv).map(([key, value]) => {
    // Escape newlines and quotes in values
    const escapedValue = String(value).replace(/\n/g, "\\n").replace(/"/g, '\\"');
    return `${key}="${escapedValue}"`;
  });
  envFileContent.push(`CONVEX_DEPLOY_KEY=${env.CONVEX_DEPLOY_KEY}`);
  const tempEnvFile = join(tmpdir(), `convex-env-${Date.now()}.env`);
  writeFileSync(tempEnvFile, envFileContent.join("\n"), "utf-8");
  return tempEnvFile;
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

  // Create temporary env file and use it for deployment
  const tempEnvFile = createTempEnvFile();

  await $`npx convex deploy --preview-create ${env.VERCEL_GIT_COMMIT_REF} --env-file ${tempEnvFile} --cmd-url-env-var-name VITE_CONVEX_URL`;

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
  // Create temporary env file and use it for deployment
  const tempEnvFile = createTempEnvFile();
  try {
    const deployOutput = await $`npx convex deploy --env-file ${tempEnvFile}`;

    // Extract Convex URL from deployment output
    const urlMatch = deployOutput.stdout.match(/https:\/\/[^\s]+\.cloud\.convex\.dev/);
    if (urlMatch) {
      process.env.VITE_CONVEX_URL = urlMatch[0];
      console.log(`Detected Convex URL: ${process.env.VITE_CONVEX_URL}`);
    } else {
      console.warn("Warning: Could not extract Convex URL from deployment output");
    }
  } finally {
    // Clean up temporary env file
    unlinkSync(tempEnvFile);
  }

  // Step 2: Run build after Convex deployment is complete
  console.log("\n=== Running build ===");
  console.log(`Building web app in: ${webAppDir}`);
  cd(webAppDir);
  await $`pnpm build`;
}
