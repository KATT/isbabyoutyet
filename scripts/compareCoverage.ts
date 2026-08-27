import { appendFile, readFile } from "node:fs/promises";

const metrics = ["statements", "branches", "functions", "lines"] as const;

type CoverageMetric = (typeof metrics)[number];
type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { readonly [key: string]: JsonValue };
type JsonObject = { readonly [key: string]: JsonValue };
type CoverageSummary = { total: JsonObject };
type CoverageResult = {
  metric: CoverageMetric;
  baseline: number;
  current: number;
  change: number;
};

const baselinePath = process.argv[2];
const currentPath = process.argv[3];

if (baselinePath === undefined || currentPath === undefined) {
  throw new Error(
    "Usage: tsx scripts/compareCoverage.ts <baseline-summary> <current-summary>",
  );
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatChange(change: number) {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
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

function buildStepSummary(results: CoverageResult[]) {
  const rows = results
    .map(
      (result) =>
        `| ${result.metric} | ${formatPct(result.baseline)} | ${formatPct(result.current)} | ${formatChange(result.change)} |`,
    )
    .join("\n");

  return [
    "## Coverage vs PR base",
    "",
    "| Metric | Baseline | Current | Change |",
    "| --- | ---: | ---: | ---: |",
    rows,
    "",
  ].join("\n");
}

function emitAnnotations(results: CoverageResult[], regressions: CoverageResult[]) {
  for (const result of results) {
    console.log(
      `::notice title=Coverage ${result.metric}::${formatPct(result.current)} (${formatChange(result.change)}) vs PR base ${formatPct(result.baseline)}`,
    );
  }

  if (regressions.length > 0) {
    const details = regressions
      .map(
        (result) =>
          `${result.metric} ${formatPct(result.current)} < base ${formatPct(result.baseline)}`,
      )
      .join("; ");
    console.log(`::error title=Coverage regressed::${details}`);
    return;
  }

  const lines = results.find((result) => result.metric === "lines");
  if (lines) {
    console.log(
      `::notice title=Coverage::lines ${formatPct(lines.current)} (${formatChange(lines.change)}) vs PR base — meets or exceeds baseline`,
    );
  }
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

const stepSummaryPath = process.env["GITHUB_STEP_SUMMARY"];
if (stepSummaryPath !== undefined && stepSummaryPath !== "") {
  await appendFile(stepSummaryPath, buildStepSummary(results), "utf8");
}

const regressions = results.filter((result) => result.change < 0);
emitAnnotations(results, regressions);

if (regressions.length > 0) {
  const details = regressions
    .map(
      (result) =>
        `${result.metric}: ${formatPct(result.current)} is below PR base's ${formatPct(result.baseline)}`,
    )
    .join("\n- ");

  throw new Error(`Coverage regressed:\n- ${details}`);
}

console.log("Coverage meets or exceeds the PR base baseline.");
