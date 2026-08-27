import { appendFile, readFile } from "node:fs/promises";

const metrics = ["statements", "branches", "functions", "lines"] as const;

type CoverageMetric = (typeof metrics)[number];
type JsonObject = Record<string, unknown>;
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
  return typeof value === "object" && value !== null;
}

function formatPct(value: number) {
  return `${value.toFixed(2)}%`;
}

function formatChange(change: number) {
  const sign = change > 0 ? "+" : "";
  return `${sign}${change.toFixed(2)}%`;
}

function truncate(text: string, maxLength: number) {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 1)}…`;
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

function buildStatusDescription(
  results: CoverageResult[],
  regressions: CoverageResult[],
) {
  if (regressions.length > 0) {
    const details = regressions
      .map(
        (result) =>
          `${result.metric} ${formatPct(result.current)} < ${formatPct(result.baseline)}`,
      )
      .join("; ");
    return truncate(`Coverage dropped: ${details}`, 140);
  }

  const lines = results.find((result) => result.metric === "lines");
  if (lines === undefined) {
    return "Coverage meets or exceeds PR base";
  }

  return truncate(
    `lines ${formatPct(lines.current)} (${formatChange(lines.change)}) vs PR base`,
    140,
  );
}

async function writeGithubOutput(fields: {
  description: string;
  conclusion: string;
}) {
  const outputPath = process.env["GITHUB_OUTPUT"];
  if (outputPath === undefined || outputPath === "") {
    return;
  }

  await appendFile(
    outputPath,
    `description=${fields.description}\nconclusion=${fields.conclusion}\n`,
    "utf8",
  );
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
const description = buildStatusDescription(results, regressions);
await writeGithubOutput({
  description,
  conclusion: regressions.length > 0 ? "failure" : "success",
});

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
