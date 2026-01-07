import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";
import { convexEnvSchema, envSchema } from "./env";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const env = envSchema.parse(process.env);
const convexEnv = convexEnvSchema.parse(process.env);

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
function syncEnvVarsToConvex() {
  console.log("Setting environment variables in Convex deployment...");

  // Set environment variables in Convex
  for (const [key, value] of Object.entries(convexEnv)) {
    // Escape the value for shell execution
    const escapedValue = value.replace(/"/g, '\\"');
    execSync(`npx convex env set ${key} "${escapedValue}"`, {
      cwd: convexPackageDir,
      stdio: "inherit",
    });
    console.log(`  ✓ Set ${key}`);
  }
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
  const deployCommand = `npx convex deploy --preview-create "${env.VERCEL_GIT_COMMIT_REF}" --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`;
  console.log(`Executing: ${deployCommand}`);

  try {
    execSync(deployCommand, {
      stdio: "inherit",
      cwd: convexPackageDir,
    });
  } catch (error) {
    // The error from execSync includes the command output when stdio is "inherit"
    // but we can still log additional context
    console.error("\n=== Deployment failed ===");

    // Check if this is the specific error about production key in preview environment
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (
      errorMessage.includes("non-production build environment") &&
      errorMessage.includes("production Convex deployment")
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

    if (error instanceof Error) {
      console.error("\nError message:", error.message);
      if ("status" in error) {
        console.error("Exit status:", error.status);
      }
      if ("signal" in error) {
        console.error("Signal:", error.signal);
      }
    }
    console.error("\nCommand that failed:", deployCommand);
    console.error("Working directory:", convexPackageDir);
    throw error;
  }

  // After deployment, set environment variables in Convex
  // Use VITE_CONVEX_URL that was set by --cmd-url-env-var-name
  syncEnvVarsToConvex();

  // Seed the data
  // Note: Alternatively, you could use --preview-run 'seed:seedPreviewDataPublic'
  // in the deploy command above, which runs automatically for preview deployments
  console.log("Seeding preview data...");

  try {
    execSync("npx convex run seed:seedPreviewDataPublic", {
      cwd: convexPackageDir,
      stdio: "inherit",
    });
  } catch (cause) {
    console.warn("Warning: Seed function failed, but deployment succeeded", cause);
  }
} else {
  // Production deployment: regular deploy (no seeding)
  console.log("Deploying Convex to production");
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Web app directory: ${webAppDir}`);
  const deployCommand = `npx convex deploy --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`;
  console.log(`Executing: ${deployCommand}`);

  try {
    execSync(
      `npx convex deploy --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`,
      {
        stdio: "inherit",
        cwd: convexPackageDir,
      },
    );
    syncEnvVarsToConvex();
  } catch (error) {
    console.error("\n=== Deployment failed ===");
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      if ("status" in error) {
        console.error("Exit status:", error.status);
      }
      if ("signal" in error) {
        console.error("Signal:", error.signal);
      }
    }
    console.error("Command that failed:", deployCommand);
    console.error("Working directory:", convexPackageDir);
    throw error;
  }
}
