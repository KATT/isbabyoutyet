#!/usr/bin/env tsx
/**
 * Vercel build command (see vercel.json): deploys the Convex backend and
 * builds the web app, following the canonical Convex + Vercel setup:
 * https://docs.convex.dev/production/hosting/vercel
 *
 * 1. `convex deploy` pushes functions and runs the web build via `--cmd`,
 *    with the deployment URL exposed as VITE_CONVEX_URL. On Vercel it
 *    automatically targets production or a per-branch preview deployment
 *    based on the CONVEX_DEPLOY_KEY. Preview backends are wiped with
 *    `--preview-create` only when the preview is missing or
 *    `schema.ts` / `convex.config.ts` change (fingerprint stored as
 *    PREVIEW_SCHEMA_FINGERPRINT). A missing fingerprint on an existing
 *    preview reuses `--preview-name` instead of wiping — create/wipe is
 *    what 408s `start_push`. GitHub merge-queue refs (`gh-readonly-queue/…`) skip
 *    the Convex push entirely — the required Vercel check only needs the
 *    web build, and a queue-specific backend would be created and thrown
 *    away. `--preview-run` reseeds demo login on a fresh backend
 *    (ignored in production).
 * 2. Runtime environment variables are synced when the backend is new
 *    (production every deploy; preview only after `--preview-create`).
 *    Consecutive preview deploys skip `env set` — SITE_URL and secrets
 *    already landed on first create. Tip: most of these can instead be
 *    configured once as project "default environment variables" in the
 *    Convex dashboard; SITE_URL is the only per-preview value.
 * 3. Pending migrations are run.
 * 4. Production bootstraps homepage demos in-band. Preview wipes seed
 *    fixture text during the build; homepage photos run from GitHub Actions
 *    after the Vercel deployment is Ready (`seed-preview.yml`).
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
  interpretEnvGetResult,
  previewDeployCliArgs,
  shouldPushConvexBackend,
  shouldRecreatePreview,
  shouldWriteConvexEnv,
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
  stdout: z.string(),
  stderr: z.string(),
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
    if (parsed.success) {
      return { ok: false, stdout: parsed.data.stdout, stderr: parsed.data.stderr };
    }
    throw error;
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

if (isPreview && !shouldPushConvexBackend(env.VERCEL_GIT_COMMIT_REF)) {
  console.log("\nGitHub merge queue — skipping Convex push, building web app only");
  execFileSync("node", [path.join(scriptsDir, "build-web.mjs")], {
    stdio: "inherit",
    env: {
      ...convexDeployEnv(),
      VITE_CONVEX_URL: MERGE_QUEUE_PLACEHOLDER_CONVEX_URL,
    },
  });
} else {
  const convexEnv = convexEnvSchema.parse({ ...env, SITE_URL: siteUrl });

  const currentFingerprint = readCurrentSchemaFingerprint();
  const storedPreview = isPreview
    ? readStoredSchemaFingerprint(env.VERCEL_GIT_COMMIT_REF)
    : { previewExists: false, fingerprint: null };
  const recreatePreview =
    isPreview &&
    shouldRecreatePreview({
      storedFingerprint: storedPreview.fingerprint,
      currentFingerprint,
      previewExists: storedPreview.previewExists,
    });

  if (isPreview) {
    if (recreatePreview) {
      console.log(
        `\nSchema changed or preview is new — recreating Convex preview "${env.VERCEL_GIT_COMMIT_REF}"`,
      );
    } else if (storedPreview.fingerprint === null) {
      console.log(
        `\nPreview exists without a schema fingerprint — reusing "${env.VERCEL_GIT_COMMIT_REF}"`,
      );
    } else {
      console.log(`\nSchema unchanged — reusing Convex preview "${env.VERCEL_GIT_COMMIT_REF}"`);
    }
  }

  convexCli([
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    "node ../../apps/web/scripts/build-web.mjs",
    ...(isPreview ? previewDeployCliArgs(env.VERCEL_GIT_COMMIT_REF, recreatePreview) : []),
  ]);

  // `convex deploy` infers the preview name from the git branch; the other
  // commands need it passed explicitly.
  const previewArgs = isPreview ? ["--preview-name", env.VERCEL_GIT_COMMIT_REF] : [];

  if (
    shouldWriteConvexEnv({
      isPreview,
      recreatePreview,
      storedFingerprint: storedPreview.fingerprint,
    })
  ) {
    for (const [key, value] of Object.entries(convexEnv)) {
      convexCli(["env", "set", key, value, ...previewArgs]);
    }
    if (isPreview) {
      convexCli(["env", "set", SCHEMA_FINGERPRINT_ENV, currentFingerprint, ...previewArgs]);
    }
  } else {
    console.log("\nConvex env already set on this preview — skipping env sync");
  }

  convexCli(["run", "migrations:runAll", ...previewArgs]);

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
      break;
    }
    if (attempt === 299) {
      throw new Error("Migrations did not finish before the deployment deadline");
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }

  if (!isPreview) {
    console.log("\n$ pnpm seed:homepage");
    execFileSync("pnpm", ["run", "seed:homepage", "--", ...previewArgs], {
      cwd: convexPackageDir,
      stdio: "inherit",
      env: process.env,
    });
  } else if (recreatePreview) {
    console.log("\n$ pnpm seed:homepage:content");
    execFileSync("pnpm", ["run", "seed:homepage:content", "--", ...previewArgs], {
      cwd: convexPackageDir,
      stdio: "inherit",
      env: process.env,
    });
  }
}
