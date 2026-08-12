#!/usr/bin/env tsx
/**
 * Vercel and Cloudflare build command: deploys the matching Convex backend
 * and builds the web app.
 *
 * 1. `convex deploy` pushes functions and runs the web build via `--cmd`,
 *    with the deployment URL exposed as VITE_CONVEX_URL.
 * 2. Runtime environment variables are synced to the Convex deployment.
 * 3. Pending migrations are run.
 *
 * Cloudflare uses `cloudflare-<branch>` preview deployments, including on
 * main while Vercel owns the production domain. This prevents the two hosts
 * from racing to overwrite Better Auth's SITE_URL on one Convex deployment.
 */
import { execFileSync } from "node:child_process";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { convexEnvSchema } from "@workspace/convex/src/env";
import * as z from "zod";
import {
  CLOUDFLARE_WORKER_NAME,
  createCloudflarePreviewAlias,
  createCloudflareSiteUrl,
  normalizeWorkersSubdomain,
} from "./cloudflare-deployment";

const vercelEnvSchema = z.object({
  VERCEL_ENV: z.enum(["production", "preview"]),
  VERCEL_GIT_COMMIT_REF: z.string().min(1), // The git branch of the commit
  VERCEL_BRANCH_URL: z.string().min(1), // The domain name of the Git branch URL
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1), // The domain name of the production project URL
  CONVEX_DEPLOY_KEY: z.string().min(1),
});

const cloudflareEnvSchema = z.object({
  WORKERS_CI: z.literal("1"),
  WORKERS_CI_BRANCH: z.string().min(1),
  CLOUDFLARE_WORKERS_SUBDOMAIN: z.string().min(1),
  CLOUDFLARE_PRODUCTION_BRANCH: z.string().min(1).default("main"),
  CONVEX_PREVIEW_DEPLOY_KEY: z.string().min(1),
  CONVEX_PRODUCTION_DEPLOY_KEY: z.string().min(1).optional(),
  CLOUDFLARE_PRODUCTION_SITE_URL: z.url().optional(),
});

const sharedEnvSchema = z.object({
  BETTER_AUTH_SECRET: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@isbabyoutyet.com"),
});

interface DeploymentContext {
  deployKey: string;
  isPreview: boolean;
  previewName?: string;
  siteUrl: string;
}

function getDeploymentContext(): DeploymentContext {
  if (process.env.WORKERS_CI === "1") {
    const env = cloudflareEnvSchema.parse(process.env);
    const isProductionBranch = env.WORKERS_CI_BRANCH === env.CLOUDFLARE_PRODUCTION_BRANCH;
    if (
      isProductionBranch &&
      env.CONVEX_PRODUCTION_DEPLOY_KEY !== undefined &&
      env.CLOUDFLARE_PRODUCTION_SITE_URL !== undefined
    ) {
      return {
        deployKey: env.CONVEX_PRODUCTION_DEPLOY_KEY,
        isPreview: false,
        siteUrl: env.CLOUDFLARE_PRODUCTION_SITE_URL,
      };
    }

    const workersSubdomain = normalizeWorkersSubdomain(env.CLOUDFLARE_WORKERS_SUBDOMAIN);
    const previewAlias = createCloudflarePreviewAlias(
      env.WORKERS_CI_BRANCH,
      CLOUDFLARE_WORKER_NAME,
    );
    return {
      deployKey: env.CONVEX_PREVIEW_DEPLOY_KEY,
      isPreview: true,
      previewName: `cloudflare-${previewAlias}`,
      siteUrl: createCloudflareSiteUrl({
        branchName: env.WORKERS_CI_BRANCH,
        productionBranch: env.CLOUDFLARE_PRODUCTION_BRANCH,
        workerName: CLOUDFLARE_WORKER_NAME,
        workersSubdomain,
      }),
    };
  }

  const env = vercelEnvSchema.parse(process.env);
  const isPreview = env.VERCEL_ENV === "preview";
  return {
    deployKey: env.CONVEX_DEPLOY_KEY,
    isPreview,
    previewName: isPreview ? env.VERCEL_GIT_COMMIT_REF : undefined,
    siteUrl: isPreview
      ? `https://${env.VERCEL_BRANCH_URL}`
      : `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`,
  };
}

const sharedEnv = sharedEnvSchema.parse(process.env);
const deployment = getDeploymentContext();
const convexEnv = convexEnvSchema.parse({
  ...sharedEnv,
  SITE_URL: deployment.siteUrl,
});

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const convexPackageDir = path.resolve(scriptsDir, "../../../packages/convex");

function convexCli(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  execFileSync("pnpm", ["convex", ...args], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: {
      ...process.env,
      CONVEX_DEPLOY_KEY: deployment.deployKey,
      VITE_SITE_URL: deployment.siteUrl,
      // Bake demo-login prefills into the web build on preview only.
      ...(deployment.isPreview ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
    },
  });
}

const previewArgs = deployment.previewName
  ? ["--preview-name", deployment.previewName]
  : [];

convexCli([
  "deploy",
  "--cmd-url-env-var-name",
  "VITE_CONVEX_URL",
  "--cmd",
  "node ../../apps/web/scripts/build-web.mjs",
  ...previewArgs,
  ...(deployment.isPreview ? ["--preview-run", "seed:seedDemoData"] : []),
]);

for (const [key, value] of Object.entries(convexEnv)) {
  convexCli(["env", "set", key, value, ...previewArgs]);
}

convexCli(["run", "migrations:runAll", ...previewArgs]);
