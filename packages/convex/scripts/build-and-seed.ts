import { execSync } from "node:child_process";
import { join } from "node:path";

const isPreview = process.env.VERCEL_ENV === "preview" || process.env.VERCEL_ENV === "development";

// Build the web app
console.log("Building web app...");
const webAppPath = join(process.cwd(), "../../apps/web");
execSync("pnpm build", { cwd: webAppPath, stdio: "inherit" });

// Seed the preview data if this is a preview deployment
if (isPreview) {
  console.log("Seeding preview data...");
  const convexPath = join(process.cwd(), "../../packages/convex");

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
    console.warn("Warning: Seed function failed, but build succeeded", cause);
  }
}
