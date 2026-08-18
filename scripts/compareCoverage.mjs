import { readFile } from "node:fs/promises";

const metrics = ["statements", "branches", "functions", "lines"];
const baselinePath = process.argv[2];
const currentPath = process.argv[3];

if (baselinePath === undefined || currentPath === undefined) {
  throw new Error(
    "Usage: node scripts/compareCoverage.mjs <baseline-summary> <current-summary>",
  );
}

async function readSummary(path) {
  const contents = await readFile(path, "utf8");
  const summary = JSON.parse(contents);

  if (
    typeof summary !== "object" ||
    summary === null ||
    !("total" in summary) ||
    typeof summary.total !== "object" ||
    summary.total === null
  ) {
    throw new Error(`Invalid coverage summary: ${path}`);
  }

  return summary;
}

function getPercentage(summary, options) {
  const metric = summary.total[options.metric];
  const percentage =
    typeof metric === "object" && metric !== null && "pct" in metric
      ? metric.pct
      : undefined;

  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    throw new Error(
      `Invalid ${options.metric} coverage percentage: ${options.path}`,
    );
  }

  return percentage;
}

const baseline = await readSummary(baselinePath);
const current = await readSummary(currentPath);
const results = metrics.map((metric) => {
  const baselinePercentage = getPercentage(baseline, {
    metric,
    path: baselinePath,
  });
  const currentPercentage = getPercentage(current, {
    metric,
    path: currentPath,
  });

  return {
    metric,
    baseline: baselinePercentage,
    current: currentPercentage,
    change: currentPercentage - baselinePercentage,
  };
});

console.table(results);

const regressions = results.filter((result) => result.change < 0);
if (regressions.length > 0) {
  const details = regressions
    .map(
      (result) =>
        `${result.metric}: ${result.current}% is below main's ${result.baseline}%`,
    )
    .join("\n- ");

  throw new Error(`Coverage regressed:\n- ${details}`);
}

console.log("Coverage meets or exceeds the main branch baseline.");
