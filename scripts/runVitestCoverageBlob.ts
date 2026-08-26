import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

const projects = [
  "convex",
  "query-prefetch",
  "convex-prefetch",
  "web",
  "oxlint-plugins",
] as const;

type Project = (typeof projects)[number];

const project = process.argv[2];

if (project === undefined || !isProject(project)) {
  throw new Error(
    `Usage: tsx scripts/runVitestCoverageBlob.ts <${projects.join("|")}>`,
  );
}

const blobsDir = path.join(process.cwd(), ".vitest-blobs");
await mkdir(blobsDir, { recursive: true });

const blobPath = path.join(blobsDir, `${project}.json`);
const args = [
  "exec",
  "vitest",
  "run",
  "--project",
  project,
  "--reporter=default",
  "--reporter=blob",
  `--outputFile.blob=${blobPath}`,
];

// oxlint-plugins does not exercise coverage.include sources; collecting
// coverage there reports 0% across the monorepo and poisons merged totals.
if (project !== "oxlint-plugins") {
  args.push(
    "--coverage",
    `--coverage.reportsDirectory=${path.join(process.cwd(), "coverage", "shards", project)}`,
  );
}

const exitCode = await new Promise<number>((resolve, reject) => {
  const child = spawn("pnpm", args, {
    stdio: "inherit",
    env: process.env,
  });
  child.on("error", reject);
  child.on("close", (code) => {
    resolve(code ?? 1);
  });
});

process.exit(exitCode);

function isProject(value: string): value is Project {
  return (projects as readonly string[]).includes(value);
}
