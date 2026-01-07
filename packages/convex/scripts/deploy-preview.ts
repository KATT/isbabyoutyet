import { execSync } from "node:child_process";
import { join } from "node:path";

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
  // The build-and-seed script will handle both building and seeding
  execSync(
    `npx convex deploy --preview "${branchName}" --cmd "npx tsx scripts/build-and-seed.ts" --cmd-url-env-var-name VITE_CONVEX_URL`,
    {
      stdio: "inherit",
      cwd: process.cwd(),
    },
  );
} else {
  // Production deployment: regular deploy (no seeding)
  console.log("Deploying Convex to production");
  const webAppPath = join(process.cwd(), "../../apps/web");
  execSync(
    `npx convex deploy --cmd "cd ../../apps/web && pnpm build" --cmd-url-env-var-name VITE_CONVEX_URL`,
    {
      stdio: "inherit",
      cwd: process.cwd(),
    },
  );
}

