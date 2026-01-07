#!/usr/bin/env zx

import * as fs from "node:fs";

import * as path from "node:path";

import { fileURLToPath } from "node:url";
import { $, cd, os } from "zx";
import { convexEnvSchema, envSchema } from "../src/env";
import z from "zod";

const run = <T>(fn: () => T): T => {
  return fn();
};

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const env = envSchema.parse(process.env);

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

// Resolve the web app directory relative to the convex package
// This script is in packages/convex/scripts/
// Web app is in apps/web/
const convexPackageDir = path.resolve(__dirname, "..");
const workspaceRoot = path.resolve(convexPackageDir, "../..");
const webAppDir = path.join(workspaceRoot, "apps", "web");

const safeDeploy = run(() => {
  const envFile = path.join(os.tmpdir(), "VITE_CONVEX_URL.txt");
  const cmd = `echo $VITE_CONVEX_URL >> ${envFile}`;

  async function deployConvex<T>(promise: Promise<T>) {
    cd(convexPackageDir);
    try {
      await promise;
    } catch (error) {
      if (error instanceof Error && error.message.includes("Uncaught ZodError:")) {
        console.log(`Unexpected ZodError (expected on first deployment)`);
      } else {
        throw error;
      }
    }

    const VITE_CONTEXT_URL = fs.readFileSync(envFile, "utf8");
    console.log("VITE_CONVEX_URL:", VITE_CONTEXT_URL);
    z.url().parse(VITE_CONTEXT_URL);

    const VITE_CONVEX_SITE_URL = VITE_CONTEXT_URL.replace(".convex.cloud", ".convex.site");
    console.log("VITE_CONVEX_SITE_URL:", VITE_CONVEX_SITE_URL);

    return {
      async syncEnvVarsToConvex() {
        console.log("Setting environment variables in Convex deployment...");
        cd(convexPackageDir);
        for (const [key, value] of Object.entries(convexEnv)) {
          await $`npx convex env set ${key} ${value} --preview-name ${env.VERCEL_GIT_COMMIT_REF}`;
        }
      },
      async buildWebApp() {
        cd(workspaceRoot);
        await $`VITE_CONVEX_SITE_URL=${VITE_CONVEX_SITE_URL} VITE_CONVEX_URL=${VITE_CONTEXT_URL} pnpm turbo build --filter=web`;
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
      $`npx convex deploy --cmd-url-env-var-name VITE_CONVEX_URL --cmd ${safeDeploy.cmd}`,
    );
    await webEnv.syncEnvVarsToConvex();
    await webEnv.buildWebApp();
  },
  development: async () => {
    throw new Error("Development deployment is not supported");
  },
  preview: async () => {
    // Preview deployment: use --preview flag
    console.log(`Deploying Convex preview deployment for branch: ${env.VERCEL_GIT_COMMIT_REF}`);
    console.log(`Working directory: ${process.cwd()}`);
    console.log(`Web app directory: ${webAppDir}`);

    const webEnv = await safeDeploy.deployConvex(
      $`npx convex deploy --preview-create ${env.VERCEL_GIT_COMMIT_REF} --cmd-url-env-var-name VITE_CONVEX_URL --cmd ${safeDeploy.cmd}`,
    );

    await $`npx convex run seed:seedPreviewData --preview-name ${env.VERCEL_GIT_COMMIT_REF} --push`;

    await webEnv.syncEnvVarsToConvex();
    await webEnv.buildWebApp();
  },
};

await cmds[env.VERCEL_ENV]();
