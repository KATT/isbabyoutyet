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

  // Deploy with preview flag and build command
  // The --cmd-url-env-var-name sets VITE_CONVEX_URL for the build command
  const deployCommand = `npx convex deploy --preview-create "${branchName}" --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`;
  console.log(`Executing: ${deployCommand}`);
  
  try {
    execSync(deployCommand, {
      stdio: "inherit",
      cwd: convexPackageDir,
      env: process.env,
    });
  } catch (error) {
    // The error from execSync includes the command output when stdio is "inherit"
    // but we can still log additional context
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

  // After deployment, seed the data
  console.log("Seeding preview data...");

  // Use VITE_CONVEX_URL that was set by --cmd-url-env-var-name
  // convex run can use CONVEX_URL environment variable
  const convexUrl = process.env.VITE_CONVEX_URL;

  if (convexUrl) {
    process.env.CONVEX_URL = convexUrl;
  }

  try {
    execSync("npx convex run seed:seedPreviewDataPublic", {
      cwd: convexPackageDir,
      stdio: "inherit",
      env: { ...process.env, CONVEX_URL: convexUrl || process.env.CONVEX_URL },
    });
  } catch (cause) {
    console.warn("Warning: Seed function failed, but deployment succeeded", cause);
  }
} else {
  // Production deployment: regular deploy (no seeding)
  console.log("Deploying Convex to production");
  console.log(`Working directory: ${process.cwd()}`);
  console.log(`Web app directory: ${webAppDir}`);
  try {
    execSync(
      `npx convex deploy --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`,
      {
        stdio: "inherit",
        cwd: convexPackageDir,
      },
    );
  } catch (error) {
    console.error("Failed to deploy Convex to production:", error);
    throw error;
  }
}
