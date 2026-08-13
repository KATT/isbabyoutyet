import { spawnSync } from "node:child_process";

const pnpm = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const stagedResult = spawnSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACMRD", "-z"],
  { encoding: "buffer" },
);

if (stagedResult.status !== 0) {
  process.stderr.write(stagedResult.stderr);
  process.exit(stagedResult.status ?? 1);
}

const stagedFiles = stagedResult.stdout.toString().split("\0").filter(Boolean);

if (stagedFiles.length === 0) {
  console.log("No staged files to check.");
  process.exit(0);
}

function run(args) {
  const result = spawnSync(pnpm, args, { stdio: "inherit" });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const globalTypecheckFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "turbo.json",
]);
const fullTestFiles = new Set([
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "vitest.config.ts",
  "apps/web/vitest.config.ts",
  "packages/convex/vitest.config.ts",
]);
const typecheckFilters = new Set();
let runAllTypechecks = false;
let runAllTests = false;

for (const file of stagedFiles) {
  if (globalTypecheckFiles.has(file)) {
    runAllTypechecks = true;
  } else if (file.startsWith("apps/web/")) {
    typecheckFilters.add("--filter=web");
  } else if (file.startsWith("packages/convex/")) {
    typecheckFilters.add("--filter=...@workspace/convex");
  } else if (file.startsWith("packages/ui/")) {
    typecheckFilters.add("--filter=...@workspace/ui");
  }

  if (fullTestFiles.has(file) || file.endsWith("/package.json")) {
    runAllTests = true;
  }
}

if (runAllTypechecks || typecheckFilters.size > 0) {
  const filterArgs = runAllTypechecks ? [] : [...typecheckFilters];
  run(["exec", "turbo", "run", "typecheck", ...filterArgs]);
}

const relatedFiles = stagedFiles.filter((file) => {
  return (
    (file.startsWith("apps/") || file.startsWith("packages/")) &&
    /\.(?:[cm]?[jt]sx?|css|json)$/.test(file)
  );
});
const hasDeletedCode = stagedFiles.some((file) => {
  return (
    relatedFiles.includes(file) && spawnSync("git", ["cat-file", "-e", `:${file}`]).status !== 0
  );
});

if (runAllTests || hasDeletedCode || relatedFiles.length > 0) {
  run(["--filter", "web", "i18n:compile"]);

  if (runAllTests || hasDeletedCode) {
    run(["exec", "vitest", "run"]);
  } else {
    run(["exec", "vitest", "related", "--run", "--passWithNoTests", ...relatedFiles]);
  }
}

if (
  stagedFiles.some((file) => {
    return file === "knip.json" || file.endsWith("/package.json") || file === "package.json";
  })
) {
  run(["knip"]);
}
