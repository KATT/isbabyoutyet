#!/usr/bin/env tsx
/**
 * Vercel build command (see vercel.json): deploys the Convex backend and
 * builds the web app, following the canonical Convex + Vercel setup:
 * https://docs.convex.dev/production/hosting/vercel
 *
 * 1. `convex deploy` pushes functions and runs the web build via `--cmd`,
 *    with the deployment URL exposed as VITE_CONVEX_URL. On Vercel it
 *    automatically targets production or a per-branch preview deployment
 *    based on the CONVEX_DEPLOY_KEY, and `--preview-run` seeds fresh
 *    preview backends with the demo login + babies (ignored in production).
 * 2. Runtime environment variables are synced to the Convex deployment.
 *    Tip: most of these can instead be configured once as project "default
 *    environment variables" in the Convex dashboard; SITE_URL is the only
 *    per-preview value.
 * 3. Pending migrations are run.
 */
import { ConvexEnv } from "@workspace/convex/src/env";
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as ChildProcess from "effect/unstable/process/ChildProcess";
import { ChildProcessSpawner } from "effect/unstable/process/ChildProcessSpawner";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

class CommandFailed extends Schema.TaggedError<CommandFailed>()("CommandFailed", {
  command: Schema.String,
  args: Schema.Array(Schema.String),
  exitCode: Schema.Number,
}) {}

const vercelEnv = Config.all({
  VERCEL_ENV: Config.literals(["production", "preview"], "VERCEL_ENV"),
  VERCEL_GIT_COMMIT_REF: Config.string("VERCEL_GIT_COMMIT_REF"),
  VERCEL_BRANCH_URL: Config.string("VERCEL_BRANCH_URL"),
  VERCEL_PROJECT_PRODUCTION_URL: Config.string("VERCEL_PROJECT_PRODUCTION_URL"),
  BETTER_AUTH_SECRET: Config.string("BETTER_AUTH_SECRET"),
  VAPID_PUBLIC_KEY: Config.string("VAPID_PUBLIC_KEY"),
  VAPID_PRIVATE_KEY: Config.string("VAPID_PRIVATE_KEY"),
  VAPID_SUBJECT: Config.string("VAPID_SUBJECT").pipe(
    Config.withDefault("mailto:admin@isbabyoutyet.com"),
  ),
});

const scriptsDir = path.dirname(fileURLToPath(import.meta.url));
const convexPackageDir = path.resolve(scriptsDir, "../../../packages/convex");

const runPnpm = Effect.fn("runPnpm")(function* (
  label: string,
  pnpmArgs: ReadonlyArray<string>,
  env: Record<string, string>,
) {
  yield* Console.log(`\n$ ${label}`);

  const spawner = yield* ChildProcessSpawner;
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make("pnpm", pnpmArgs, {
      cwd: convexPackageDir,
      extendEnv: true,
      env,
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );

  if (Number(exitCode) !== 0) {
    return yield* new CommandFailed({
      command: "pnpm",
      args: [...pnpmArgs],
      exitCode: Number(exitCode),
    });
  }
});

const program = Effect.gen(function* () {
  const env = yield* vercelEnv;
  const isPreview = env.VERCEL_ENV === "preview";

  const siteUrl = isPreview
    ? `https://${env.VERCEL_BRANCH_URL}`
    : `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`;

  const convexEnv = yield* Schema.decodeUnknownEffect(ConvexEnv)({
    ...env,
    SITE_URL: siteUrl,
  });

  const childEnv = {
    VITE_SITE_URL: siteUrl,
    ...(isPreview ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
  };

  const runInConvexPackage = (command: string, args: ReadonlyArray<string>) =>
    runPnpm(`${command} ${args.join(" ")}`, ["exec", command, ...args], childEnv);

  const convexCli = (args: ReadonlyArray<string>) =>
    runPnpm(`convex ${args.join(" ")}`, ["convex", ...args], childEnv);

  // Refresh Confect → Convex codegen so deploy always ships a consistent
  // convex/ tree (even if a local edit forgot to run `confect codegen`).
  yield* runInConvexPackage("confect", ["codegen"]);

  yield* convexCli([
    "deploy",
    "--cmd-url-env-var-name",
    "VITE_CONVEX_URL",
    "--cmd",
    "pnpm exec tsx ../../apps/web/scripts/build-web.ts",
    ...(isPreview ? (["--preview-run", "seed:seedDemoData"] as const) : []),
  ]);

  // `convex deploy` infers the preview name from the git branch; the other
  // commands need it passed explicitly.
  const previewArgs = isPreview
    ? (["--preview-name", env.VERCEL_GIT_COMMIT_REF] as const)
    : ([] as const);

  for (const [key, value] of Object.entries(convexEnv)) {
    yield* convexCli(["env", "set", key, value, ...previewArgs]);
  }

  yield* convexCli(["run", "migrations:runAll", ...previewArgs]);
}).pipe(Effect.provide(NodeServices.layer), Effect.orDie);

NodeRuntime.runMain(program);
