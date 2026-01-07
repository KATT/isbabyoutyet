import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import { existsSync } from "node:fs";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Get the branch name from Vercel environment variable
const branchName =
  process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || process.env.BRANCH_NAME || "main";

// Determine if this is a preview deployment
// Vercel sets VERCEL_ENV to "preview" for preview deployments
// For local testing, set PREVIEW=true or VERCEL_ENV=preview
const isPreview =
  process.env.VERCEL_ENV === "preview" ||
  process.env.VERCEL_ENV === "development" ||
  process.env.PREVIEW === "true";

if (isPreview) {
  // Preview deployment: use --preview flag
  console.log(`Deploying Convex preview deployment for branch: ${branchName}`);
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Web app directory: ${webAppDir}`);

  // For preview deployments, CONVEX_DEPLOY_KEY should be set to a Preview Deploy Key
  // See: https://docs.convex.dev/production/hosting/vercel#preview-deployments
  // The key should be scoped to Preview environment only in Vercel
  const deployEnv = { ...process.env };

  // Support both CONVEX_PREVIEW_DEPLOY_KEY (custom) and CONVEX_DEPLOY_KEY (standard)
  if (process.env.CONVEX_PREVIEW_DEPLOY_KEY) {
    deployEnv.CONVEX_DEPLOY_KEY = process.env.CONVEX_PREVIEW_DEPLOY_KEY;
    console.log("Using CONVEX_PREVIEW_DEPLOY_KEY for preview deployment");
  } else if (process.env.CONVEX_DEPLOY_KEY) {
    console.log("Using CONVEX_DEPLOY_KEY for preview deployment");
    console.log("Note: This should be a Preview Deploy Key (not a Production key)");
  } else {
    console.error("Error: CONVEX_DEPLOY_KEY not found. Please set a Preview Deploy Key in Vercel.");
    console.error("See: https://docs.convex.dev/production/hosting/vercel#preview-deployments");
    process.exit(1);
  }

  // Deploy with preview flag and build command
  // The --cmd-url-env-var-name sets VITE_CONVEX_URL for the build command
  // --preview-create customizes the deployment name (optional, Convex infers branch name automatically)
  const deployCommand = `npx convex deploy --preview-create "${branchName}" --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`;
  console.log(`Executing: ${deployCommand}`);

  try {
    execSync(deployCommand, {
      stdio: "inherit",
      cwd: convexPackageDir,
      env: deployEnv,
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

  // After deployment, seed the data
  // Note: Alternatively, you could use --preview-run 'seed:seedPreviewDataPublic'
  // in the deploy command above, which runs automatically for preview deployments
  console.log("Seeding preview data...");

  // Use VITE_CONVEX_URL that was set by --cmd-url-env-var-name
  // convex run can use CONVEX_URL environment variable
  const convexUrl = process.env.VITE_CONVEX_URL;

  if (convexUrl) {
    deployEnv.CONVEX_URL = convexUrl;
  } else {
    console.warn("Warning: VITE_CONVEX_URL not set. Seed function may not work correctly.");
  }

  try {
    execSync("npx convex run seed:seedPreviewDataPublic", {
      cwd: convexPackageDir,
      stdio: "inherit",
      env: deployEnv,
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
    execSync(deployCommand, {
      stdio: "inherit",
      cwd: convexPackageDir,
      env: process.env,
    });
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
