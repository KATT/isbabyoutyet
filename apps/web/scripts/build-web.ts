#!/usr/bin/env tsx
/**
 * Runs the web app build. Invoked by `convex deploy --cmd` (see
 * deploy-convex.ts), which sets VITE_CONVEX_URL to the deployment URL;
 * the .convex.site URL is derived from it.
 */
import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as Config from "effect/Config";
import * as Console from "effect/Console";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
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

const workspaceRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

const program = Effect.gen(function* () {
  const convexUrl = yield* Config.string("VITE_CONVEX_URL");
  const hasDemoLoginFlag = yield* Config.option(Config.string("VITE_HAS_DEMO_LOGIN"));
  const vercelEnv = yield* Config.option(Config.string("VERCEL_ENV"));

  const hasDemoLogin =
    Option.contains(hasDemoLoginFlag, "true") || Option.contains(vercelEnv, "preview");

  yield* Console.log("\n$ pnpm turbo build --filter=web");

  const spawner = yield* ChildProcessSpawner;
  const exitCode = yield* spawner.exitCode(
    ChildProcess.make("pnpm", ["turbo", "build", "--filter=web"], {
      cwd: workspaceRoot,
      extendEnv: true,
      env: {
        VITE_CONVEX_SITE_URL: convexUrl.replace(".convex.cloud", ".convex.site"),
        ...(hasDemoLogin ? { VITE_HAS_DEMO_LOGIN: "true" } : {}),
      },
      stdin: "inherit",
      stdout: "inherit",
      stderr: "inherit",
    }),
  );

  if (Number(exitCode) !== 0) {
    return yield* new CommandFailed({
      command: "pnpm",
      args: ["turbo", "build", "--filter=web"],
      exitCode: Number(exitCode),
    });
  }
}).pipe(Effect.provide(NodeServices.layer), Effect.orDie);

NodeRuntime.runMain(program);
