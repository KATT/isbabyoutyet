import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve the web app directory relative to the convex package
// This script is in packages/convex/scripts/
// Web app is in apps/web/
const convexPackageDir = resolve(__dirname, "..");
const workspaceRoot = resolve(convexPackageDir, "../..");
const webAppDir = join(workspaceRoot, "apps", "web");

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
  try {
    execSync(
      `npx convex deploy --preview-create "${branchName}" --cmd "cd ${webAppDir} && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`,
      {
        stdio: "inherit",
        cwd: convexPackageDir,
      },
    );
  } catch (error) {
    console.error("Failed to deploy Convex preview:", error);
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
