#!/usr/bin/env zx

import * as fs from "node:fs";

import * as path from "node:path";

import { fileURLToPath } from "node:url";
import { $, cd, os } from "zx";
import { convexEnvSchema } from "@workspace/convex/src/env";
import * as z from "zod";

const run = <T>(fn: () => T): T => {
  return fn();
};

const vercelEnvSchema = z.object({
  VERCEL_ENV: z.enum(["production", "preview", "development"]),
  VERCEL_GIT_COMMIT_REF: z.string().min(1), // The git branch of the commit
  VERCEL_BRANCH_URL: z.string().min(1), // The domain name of the Git branch URL

  BETTER_AUTH_SECRET: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@isbabyoutyet.com"),
});

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = vercelEnvSchema.parse(process.env);

// Determine the site URL for Convex backend
// For preview: use VERCEL_BRANCH_URL
// For production: use VERCEL_URL (available in all Vercel environments)
const siteUrl =
  env.VERCEL_ENV === "preview"
    ? `https://${env.VERCEL_BRANCH_URL}`
    : `https://${process.env.VERCEL_URL}`;

const convexEnv = convexEnvSchema.parse({
  ...env,
  SITE_URL: siteUrl,
});

// Resolve paths relative to the web app scripts directory
// This script is in apps/web/scripts/
// Convex package is in packages/convex/
const workspaceRoot = path.resolve(__dirname, "../../..");
const convexPackageDir = path.resolve(workspaceRoot, "packages/convex");
const webAppDir = path.resolve(__dirname, "..");

// Verify the convex package directory exists
if (!fs.existsSync(convexPackageDir)) {
  throw new Error(
    `Convex package directory not found: ${convexPackageDir}\n` +
      `Workspace root: ${workspaceRoot}\n` +
      `Script directory: ${__dirname}\n` +
      `Current working directory: ${process.cwd()}`,
  );
}

const safeDeploy = run(() => {
  const envFile = path.join(os.tmpdir(), "VITE_CONVEX_URL.txt");
  const cmd = `echo $VITE_CONVEX_URL >> ${envFile}`;

  async function deployConvex<T>(cb: () => Promise<T>) {
    cd(convexPackageDir);
    try {
      await cb();
    } catch (error) {
      if (error instanceof Error && error.message.includes("Uncaught ZodError:")) {
        console.log(`Unexpected ZodError (expected on first deployment)`);
      } else {
        throw error;
      }
    }

    const VITE_CONTEXT_URL = fs.readFileSync(envFile, "utf8").trim();
    console.log("VITE_CONVEX_URL:", VITE_CONTEXT_URL);
    z.url().parse(VITE_CONTEXT_URL);

    const VITE_CONVEX_SITE_URL = VITE_CONTEXT_URL.replace(".convex.cloud", ".convex.site");
    console.log("VITE_CONVEX_SITE_URL:", VITE_CONVEX_SITE_URL);

    return {
      async syncEnvVarsToConvex() {
        console.log("Setting environment variables in Convex deployment...");
        cd(convexPackageDir);
        await $`echo "Current working directory: $(pwd)"`;

        for (const [key, value] of Object.entries(convexEnv)) {
          if (env.VERCEL_ENV === "preview") {
            await $`pnpm convex env set ${key} ${value} --preview-name ${env.VERCEL_GIT_COMMIT_REF}`;
          } else {
            await $`pnpm convex env set ${key} ${value}`;
          }
        }
      },
      async buildWebApp() {
        cd(workspaceRoot);
        await $`VITE_CONVEX_SITE_URL=${VITE_CONVEX_SITE_URL} VITE_CONVEX_URL=${VITE_CONTEXT_URL} VITE_SITE_URL=${siteUrl} pnpm turbo build --filter=web`;
      },
    };
  }
  return {
    cmd,
    deployConvex,
  };
});

const cmds: Record<typeof env.VERCEL_ENV, () => Promise<void>> = {
  production: async () => {
    const webEnv = await safeDeploy.deployConvex(
      () => $`pnpm convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd ${safeDeploy.cmd}`,
    );
    await webEnv.syncEnvVarsToConvex();

    console.log("Running migrations...");
    cd(convexPackageDir);
    await $`pnpm convex run migrations:runAll --push`;

    await webEnv.buildWebApp();
  },
  development: async () => {
    throw new Error("Development deployment is not supported");
  },
  preview: async () => {
    // Preview deployment: use --preview flag
    console.log(`Deploying Convex preview deployment for branch: ${env.VERCEL_GIT_COMMIT_REF}`);
    console.log(`Script directory: ${__dirname}`);
    console.log(`Workspace root: ${workspaceRoot}`);
    console.log(`Working directory: ${process.cwd()}`);
    console.log(`Web app directory: ${webAppDir}`);
    console.log(`Convex package directory: ${convexPackageDir}`);
    console.log(`Convex package exists: ${fs.existsSync(convexPackageDir)}`);

    const webEnv = await safeDeploy.deployConvex(
      () =>
        $`pnpm convex deploy --preview-create ${env.VERCEL_GIT_COMMIT_REF} --cmd-url-env-var-name VITE_CONVEX_URL --cmd ${safeDeploy.cmd}`,
    );

    console.log("Running seed script...");
    cd(convexPackageDir);
    await $`pnpm convex run seed:seedPreviewData --preview-name ${env.VERCEL_GIT_COMMIT_REF} --push`;

    await webEnv.syncEnvVarsToConvex();

    console.log("Running migrations...");
    cd(convexPackageDir);
    await $`pnpm convex run migrations:runAll --preview-name ${env.VERCEL_GIT_COMMIT_REF} --push`;

    await webEnv.buildWebApp();
  },
};

await cmds[env.VERCEL_ENV]();
