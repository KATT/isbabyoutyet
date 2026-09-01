#!/usr/bin/env tsx
/**
 * Vercel build command (see vercel.json): deploys the Convex backend and
 * builds the web app, following the canonical Convex + Vercel setup:
 * https://docs.convex.dev/production/hosting/vercel
 *
 * Decision logic lives in `planConvexDeploy`. This script probes the
 * current preview fingerprint, logs one sentence, then runs a linear
 * step list:
 *
 * 1. Merge-queue refs (`gh-readonly-queue/…`) skip the Convex push —
 *    the required Vercel check only needs the web build, and a
 *    queue-specific backend would be created and thrown away.
 * 2. Otherwise `convex deploy` pushes functions and runs the web build
 *    via `--cmd`. Preview backends are wiped with `--preview-create`
 *    only when the preview is missing or `schema.ts` / `convex.config.ts`
 *    change. A missing fingerprint on an existing preview reuses
 *    `--preview-name` (create/wipe is what 408s `start_push`).
 *    `--preview-run` reseeds demo login on a fresh backend.
 * 3. Runtime environment variables are synced when the plan says so
 *    (production every deploy; preview after create or first fingerprint
 *    write). Consecutive matching-fingerprint preview deploys skip
 *    `env set`.
 * 4. Pending migrations are run.
 * 5. Production bootstraps homepage demos in-band. Preview wipes seed
 *    fixture text during the build; homepage photos run from GitHub
 *    Actions after the Vercel deployment is Ready (`seed-preview.yml`).
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { convexEnvSchema } from "@workspace/convex/src/env";
import {
  MERGE_QUEUE_PLACEHOLDER_CONVEX_URL,
  SCHEMA_FINGERPRINT_ENV,
  SCHEMA_FINGERPRINT_RELATIVE_PATHS,
  computeSchemaFingerprint,
  convexDeployCliArgs,
  describeConvexDeployPlan,
  interpretEnvGetResult,
  planConvexDeploy,
  previewNameCliArgs,
  shouldPushConvexBackend,
} from "@workspace/convex/src/previewDeploy";
import * as z from "zod";

const vercelEnvSchema = z.object({
  VERCEL_ENV: z.enum(["production", "preview"]),
  VERCEL_GIT_COMMIT_REF: z.string().min(1), // The git branch of the commit
  VERCEL_BRANCH_URL: z.string().min(1), // The domain name of the Git branch URL
  VERCEL_PROJECT_PRODUCTION_URL: z.string().min(1), // The domain name of the production project URL

  BETTER_AUTH_SECRET: z.string().min(1),
  VAPID_PUBLIC_KEY: z.string().min(1),
  VAPID_PRIVATE_KEY: z.string().min(1),
  VAPID_SUBJECT: z.string().optional().default("mailto:admin@isbabyoutyet.com"),
});

const env = vercelEnvSchema.parse(process.env);
const isPreview = env.VERCEL_ENV === "preview";

const siteUrl = isPreview
  ? `https://${env.VERCEL_BRANCH_URL}`
  : `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const convexPackageDir = path.resolve(scriptsDir, "../../../packages/convex");

function convexDeployEnv() {
  const baseEnv = {
    ...process.env,
    VITE_SITE_URL: siteUrl,
  };
  if (!isPreview) {
    return baseEnv;
  }
  return {
    ...baseEnv,
    VITE_HAS_DEMO_LOGIN: "true",
  };
}

function convexCli(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  execFileSync("pnpm", ["convex", ...args], {
    cwd: convexPackageDir,
    stdio: "inherit",
    env: convexDeployEnv(),
  });
}

function convexCliOutput(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  return execFileSync("pnpm", ["convex", ...args], {
    cwd: convexPackageDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
    env: convexDeployEnv(),
  });
}

const execFileErrorSchema = z.object({
  stdout: z.union([z.string(), z.null()]),
  stderr: z.union([z.string(), z.null()]),
});

function convexCliCaptured(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  try {
    const stdout = execFileSync("pnpm", ["convex", ...args], {
      cwd: convexPackageDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: convexDeployEnv(),
    });
    return { ok: true, stdout, stderr: "" };
  } catch (error) {
    const parsed = execFileErrorSchema.safeParse(error);
    if (!parsed.success) {
      throw error;
    }
    return {
      ok: false,
      stdout: parsed.data.stdout ?? "",
      stderr: parsed.data.stderr ?? "",
    };
  }
}

function readCurrentSchemaFingerprint() {
  const files = SCHEMA_FINGERPRINT_RELATIVE_PATHS.map((relativePath) => ({
    path: relativePath,
    contents: fs.readFileSync(path.join(convexPackageDir, relativePath), "utf8"),
  }));
  return computeSchemaFingerprint(files);
}

function readStoredSchemaFingerprint(previewName: string) {
  return interpretEnvGetResult(
    convexCliCaptured(["env", "get", SCHEMA_FINGERPRINT_ENV, "--preview-name", previewName]),
  );
}

async function waitForMigrations(previewArgs: string[]) {
  const migrationStatusSchema = z.object({
    isDone: z.boolean(),
    failed: z.array(z.string()),
  });

  for (let attempt = 0; attempt < 300; attempt += 1) {
    const status = migrationStatusSchema.parse(
      JSON.parse(convexCliOutput(["run", "migrations:deploymentStatus", ...previewArgs])),
    );
    if (status.failed.length > 0) {
      throw new Error(`Migration failed: ${status.failed.join("; ")}`);
    }
    if (status.isDone) {
      return;
    }
    if (attempt === 299) {
      throw new Error("Migrations did not finish before the deployment deadline");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 1_000);
    });
  }
}

const pushConvex = shouldPushConvexBackend(env.VERCEL_GIT_COMMIT_REF);
const currentFingerprint = pushConvex ? readCurrentSchemaFingerprint() : "";
const stored =
  isPreview && pushConvex
    ? readStoredSchemaFingerprint(env.VERCEL_GIT_COMMIT_REF)
    : { previewExists: false, fingerprint: null };

const plan = planConvexDeploy({
  vercelEnv: env.VERCEL_ENV,
  gitRef: env.VERCEL_GIT_COMMIT_REF,
  currentFingerprint,
  stored,
});

console.log(`\n${describeConvexDeployPlan(plan)}`);

if (plan.kind === "merge-queue-web-only") {
  execFileSync("node", [path.join(scriptsDir, "build-web.mjs")], {
    stdio: "inherit",
    env: {
      ...convexDeployEnv(),
      VITE_CONVEX_URL: MERGE_QUEUE_PLACEHOLDER_CONVEX_URL,
    },
  });
} else {
  const convexEnv = convexEnvSchema.parse({ ...env, SITE_URL: siteUrl });
  const previewArgs = previewNameCliArgs(plan);

  convexCli([
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    "node ../../apps/web/scripts/build-web.mjs",
    ...convexDeployCliArgs(plan),
  ]);

  if (plan.writeEnv) {
    for (const [key, value] of Object.entries(convexEnv)) {
      convexCli(["env", "set", key, value, ...previewArgs]);
    }
    if (plan.kind !== "production") {
      convexCli(["env", "set", SCHEMA_FINGERPRINT_ENV, currentFingerprint, ...previewArgs]);
    }
  } else {
    console.log("\nConvex env already set on this preview — skipping env sync");
  }

  convexCli(["run", "migrations:runAll", ...previewArgs]);
  await waitForMigrations(previewArgs);

  if (plan.seed) {
    console.log(`\n$ pnpm ${plan.seed}`);
    execFileSync("pnpm", ["run", plan.seed, "--", ...previewArgs], {
      cwd: convexPackageDir,
      stdio: "inherit",
      env: process.env,
    });
  }
}
