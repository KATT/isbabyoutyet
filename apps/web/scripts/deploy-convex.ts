#!/usr/bin/env tsx
/**
 * Vercel build command (see vercel.json): deploys the Convex backend and
 * builds the web app, following the canonical Convex + Vercel setup:
 * https://docs.convex.dev/production/hosting/vercel
 *
 * vercel.json pins `framework: "tanstack-start"` so this monorepo is not
 * treated as Other. The Vercel TanStack Start guide says not to set a
 * build command or output directory — we keep `buildCommand` only so
 * Convex deploy runs before `vite build`, and we omit `outputDirectory`
 * so Nitro can emit the Vercel Build Output API (functions + static).
 * https://vercel.com/kb/guide/deploy-a-tanstack-start-app-to-vercel
 *
 * Decision logic lives in `planConvexDeploy`. This script probes the
 * current preview fingerprint, logs one sentence, then runs a linear
 * step list:
 *
 * 1. Merge-queue refs (`gh-readonly-queue/…`) skip the Convex push —
 *    the required Vercel check only needs the web build, and a
 *    queue-specific backend would be created and thrown away.
 * 2. Otherwise `convex deploy` claims the preview, runs a tiny `--cmd`
 *    that writes `VITE_CONVEX_URL` to a temp file, then `start_push`es
 *    immediately. (A Vite `--cmd` used to finish first, so a 5-minute
 *    `start_push` 408 happened after a successful web build.) Missing
 *    previews use `--preview-name` (create, no wipe). `--preview-create`
 *    wipes only when an existing preview's schema fingerprint changed.
 *    `--preview-run` reseeds demo login on a fresh backend. If
 *    `start_push` 408s, retry once with `--preview-name` (the preview
 *    is already claimed). A second 408 fails the Vercel build. After
 *    a successful push, the web app is built with the written URL.
 * 3. Runtime environment variables are synced when the plan says so
 *    (production every deploy; preview after create or first fingerprint
 *    write). Consecutive matching-fingerprint preview deploys skip
 *    `env set`.
 * 4. Pending migrations are run.
 * 5. Production bootstraps homepage demos in-band. Preview wipes seed
 *    fixture text during the build; homepage photos run from GitHub
 *    Actions after the Vercel deployment is Ready (`seed-preview.yml`).
 *    Create/recreate also `convex run seed:seedDemoData` here because a
 *    408 retry uses `--preview-name` and Convex then skips `--preview-run`.
 */
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { fileURLToPath } from "node:url";
import { convexEnvSchema } from "@workspace/convex/src/env";
import {
  MERGE_QUEUE_PLACEHOLDER_CONVEX_URL,
  SCHEMA_FINGERPRINT_ENV,
  SCHEMA_FINGERPRINT_RELATIVE_PATHS,
  computeSchemaFingerprint,
  convexDeployArgv,
  convexDeployCliArgs,
  convexDeployRetryCliArgs,
  convexPostPushRunFunctions,
  convexSeedNpmScripts,
  describeConvexDeployPlan,
  interpretEnvGetResult,
  isConvexStartPushTimeout,
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

function convexCliResult(args: string[]) {
  console.log(`\n$ convex ${args.join(" ")}`);
  try {
    const stdout = execFileSync("pnpm", ["convex", ...args], {
      cwd: convexPackageDir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: convexDeployEnv(),
    });
    process.stdout.write(stdout);
    return { ok: true as const, stdout, stderr: "" };
  } catch (error) {
    const parsed = execFileErrorSchema.safeParse(error);
    if (!parsed.success) {
      throw error;
    }
    const stdout = parsed.data.stdout ?? "";
    const stderr = parsed.data.stderr ?? "";
    process.stdout.write(stdout);
    process.stderr.write(stderr);
    return { ok: false as const, stdout, stderr };
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

function buildWebApp(convexUrl: string) {
  execFileSync("node", [path.join(scriptsDir, "build-web.mjs")], {
    stdio: "inherit",
    env: {
      ...convexDeployEnv(),
      VITE_CONVEX_URL: convexUrl,
    },
  });
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
  buildWebApp(MERGE_QUEUE_PLACEHOLDER_CONVEX_URL);
} else {
  const convexEnv = convexEnvSchema.parse({ ...env, SITE_URL: siteUrl });
  const previewArgs = previewNameCliArgs(plan);
  const convexUrlFile = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "convex-url-")),
    "vite-convex-url",
  );
  process.env.CONVEX_URL_FILE = convexUrlFile;

  let deploy = convexCliResult(convexDeployArgv(convexDeployCliArgs(plan)));
  if (!deploy.ok && isConvexStartPushTimeout(`${deploy.stdout}\n${deploy.stderr}`)) {
    console.log("\nConvex start_push timed out — retrying without a wipe");
    deploy = convexCliResult(convexDeployArgv(convexDeployRetryCliArgs(plan)));
  }
  if (!deploy.ok) {
    throw new Error(`convex deploy failed:\n${deploy.stdout}\n${deploy.stderr}`);
  }

  const convexUrl = fs.readFileSync(convexUrlFile, "utf8").trim();
  if (convexUrl.length === 0) {
    throw new Error("convex deploy did not write VITE_CONVEX_URL");
  }
  buildWebApp(convexUrl);

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

  for (const functionName of convexPostPushRunFunctions(plan)) {
    convexCli(["run", functionName, ...previewArgs]);
  }

  for (const script of convexSeedNpmScripts(plan)) {
    console.log(`\n$ pnpm ${script}`);
    execFileSync("pnpm", ["run", script, "--", ...previewArgs], {
      cwd: convexPackageDir,
      stdio: "inherit",
      env: process.env,
    });
  }
}
