import { execSync } from "node:child_process";

// Get the branch name from Vercel environment variable
const branchName = process.env.VERCEL_GIT_COMMIT_REF || process.env.GIT_BRANCH || "main";

// Determine if this is a preview deployment
// Vercel sets VERCEL_ENV to "preview" for preview deployments
const isPreview = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development";

if (isPreview) {
  // Preview deployment: use --preview flag
  console.log(`Deploying Convex preview deployment for branch: ${branchName}`);

  // Deploy with preview flag and build command
  // The --cmd-url-env-var-name sets VITE_CONVEX_URL for the build command
  execSync(
    `npx convex deploy --preview "${branchName}" --cmd "cd ../../apps/web && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`,
    {
      stdio: "inherit",
      cwd: process.cwd(),
    },
  );

  // After deployment, seed the data
  console.log("Seeding preview data...");
  const convexPath = process.cwd();

  // Use VITE_CONVEX_URL that was set by --cmd-url-env-var-name
  // convex run can use CONVEX_URL environment variable
  const convexUrl = process.env.VITE_CONVEX_URL;

  if (convexUrl) {
    process.env.CONVEX_URL = convexUrl;
  }

  try {
    execSync("npx convex run seed:seedPreviewDataPublic", {
      cwd: convexPath,
      stdio: "inherit",
      env: { ...process.env, CONVEX_URL: convexUrl || process.env.CONVEX_URL },
    });
  } catch (cause) {
    console.warn("Warning: Seed function failed, but deployment succeeded", cause);
  }
} else {
  // Production deployment: regular deploy (no seeding)
  console.log("Deploying Convex to production");
  execSync(
    `npx convex deploy --cmd "cd ../../apps/web && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`,
    {
      stdio: "inherit",
      cwd: process.cwd(),
    },
  );
}
