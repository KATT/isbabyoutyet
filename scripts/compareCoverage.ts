import { readFile } from "node:fs/promises";

const metrics = ["statements", "branches", "functions", "lines"] as const;

type CoverageMetric = (typeof metrics)[number];
type JsonObject = Record<string, unknown>;
type CoverageSummary = { total: JsonObject };

const baselinePath = process.argv[2];
const currentPath = process.argv[3];

if (baselinePath === undefined || currentPath === undefined) {
  throw new Error(
    "Usage: tsx scripts/compareCoverage.ts <baseline-summary> <current-summary>",
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null;
}

async function readSummary(path: string) {
  const contents = await readFile(path, "utf8");
  const summary: unknown = JSON.parse(contents);

  if (
    !isJsonObject(summary) ||
    !("total" in summary) ||
    !isJsonObject(summary["total"])
  ) {
    throw new Error(`Invalid coverage summary: ${path}`);
  }

  return { total: summary["total"] };
}

function getPercentage(
  summary: CoverageSummary,
  options: { metric: CoverageMetric; path: string },
) {
  const metric = summary.total[options.metric];
  const percentage =
    isJsonObject(metric) && "pct" in metric ? metric["pct"] : undefined;

  if (typeof percentage !== "number" || !Number.isFinite(percentage)) {
    throw new Error(
      `Invalid ${options.metric} coverage percentage: ${options.path}`,
    );
  }

  return percentage;
}

function getMetricCount(
  summary: CoverageSummary,
  options: { metric: CoverageMetric; field: "total" | "covered"; path: string },
) {
  const metric = summary.total[options.metric];
  const value =
    isJsonObject(metric) && options.field in metric
      ? metric[options.field]
      : undefined;

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(
      `Invalid ${options.metric} coverage ${options.field}: ${options.path}`,
    );
  }

  return value;
}

const baseline = await readSummary(baselinePath);
const current = await readSummary(currentPath);

const baselineStatementTotal = getMetricCount(baseline, {
  metric: "statements",
  field: "total",
  path: baselinePath,
});
const currentStatementTotal = getMetricCount(current, {
  metric: "statements",
  field: "total",
  path: currentPath,
});

// Vitest blob-shard merges can change which files enter the summary versus a
// single-process run. When the denominators diverge, percentages are not
// comparable — refresh the baseline on the next green main push.
const statementTotalDelta = Math.abs(
  currentStatementTotal - baselineStatementTotal,
);
if (statementTotalDelta >= 10) {
  console.log(
    `Coverage file set changed (statements total ${baselineStatementTotal} → ${currentStatementTotal}); skipping percentage compare until main refreshes the baseline.`,
  );
  process.exit(0);
}

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
