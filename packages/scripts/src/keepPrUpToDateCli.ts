import { execFile } from "node:child_process";
import { appendFile } from "node:fs/promises";
import { promisify } from "node:util";
import type { JsonValue } from "@workspace/runtime/json";
import { isJsonObjectValue, parseJsonNumber } from "@workspace/runtime/json";
import {
  parseGhPullRequests,
  planKeepUpToDate,
  withBehindBy,
  type KeepUpToDateDecision,
  type ParsedPullRequest,
  type PullRequest,
} from "./keepPrUpToDate";
import { rebaseStackBranches } from "./keepPrUpToDateGit";

const execFileAsync = promisify(execFile);

const jsonFields = [
  "number",
  "title",
  "headRefName",
  "baseRefName",
  "headRefOid",
  "baseRefOid",
  "isDraft",
  "isCrossRepository",
  "autoMergeRequest",
  "mergeable",
  "statusCheckRollup",
].join(",");

async function main() {
  const repo = process.env["GITHUB_REPOSITORY"];
  if (repo === undefined || repo === "") {
    throw new Error("GITHUB_REPOSITORY is required");
  }
  const dryRun = process.env["KEEP_PR_UP_TO_DATE_DRY_RUN"] === "1";
  const repoDir = process.cwd();

  let parsed = await listOpenPullRequests();
  if (parsed.some((pr) => pr.mergeable === "UNKNOWN")) {
    await delay(2000);
    parsed = await listOpenPullRequests();
  }
  const prs = await Promise.all(parsed.map((pr) => withCompare(repo, pr)));
  const decisions = planKeepUpToDate(prs);

  const lines = ["## Keep auto-merge PRs up to date", ""];
  if (decisions.length === 0) {
    const line = "No auto-merge PRs needed updating.";
    lines.push(line);
    console.log(line);
  }

  for (const decision of decisions) {
    const line = await applyDecision(decision, {
      repo,
      repoDir,
      dryRun,
    });
    lines.push(`- ${line}`);
    console.log(line);
  }

  const summaryPath = process.env["GITHUB_STEP_SUMMARY"];
  if (summaryPath !== undefined && summaryPath !== "") {
    await appendFile(summaryPath, `${lines.join("\n")}\n`, "utf8");
  }
}

async function listOpenPullRequests(): Promise<ParsedPullRequest[]> {
  const listed = await gh([
    "pr",
    "list",
    "--state",
    "open",
    "--limit",
    "100",
    "--json",
    jsonFields,
  ]);
  return parseGhPullRequests(parseJson(listed));
}

async function withCompare(repo: string, pr: ParsedPullRequest): Promise<PullRequest> {
  const output = await gh(["api", `repos/${repo}/compare/${pr.baseRefOid}...${pr.headRefOid}`]);
  const payload = parseJson(output);
  if (!isJsonObjectValue(payload)) {
    throw new Error(`Compare payload for #${String(pr.number)} was not an object`);
  }
  const behindBy = parseJsonNumber(payload["behind_by"]);
  if (behindBy === null) {
    throw new Error(`Compare payload for #${String(pr.number)} is missing behind_by`);
  }
  return withBehindBy(pr, behindBy);
}

async function applyDecision(
  decision: KeepUpToDateDecision,
  opts: { repo: string; repoDir: string; dryRun: boolean },
): Promise<string> {
  switch (decision.action) {
    case "skip":
      return `skip #${decision.prNumbers.join(", #")}: ${decision.reason}`;
    case "update-branch": {
      const label = `#${String(decision.prNumber)} (${decision.headRefName})`;
      if (opts.dryRun) {
        return `would update-branch ${label}`;
      }
      try {
        await gh([
          "api",
          "--method",
          "PUT",
          `repos/${opts.repo}/pulls/${String(decision.prNumber)}/update-branch`,
          "-f",
          `expected_head_sha=${decision.headRefOid}`,
        ]);
        return `updated branch ${label}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "update-branch failed";
        return `failed to update ${label}: ${message}`;
      }
    }
    case "rebase-stack": {
      const numbers = decision.prs.map((pr) => `#${String(pr.number)}`).join(", ");
      const root = decision.prs[0];
      if (root === undefined) {
        return "skip stack: empty";
      }
      if (opts.dryRun) {
        return `would rebase stack ${numbers} onto ${root.baseRefName}`;
      }
      try {
        await fetchRefs(opts.repoDir, [
          root.baseRefName,
          ...decision.prs.map((pr) => pr.headRefName),
        ]);
        for (const pr of decision.prs) {
          await git(opts.repoDir, [
            "checkout",
            "--quiet",
            "-B",
            pr.headRefName,
            `origin/${pr.headRefName}`,
          ]);
        }
        const result = await rebaseStackBranches({
          repoDir: opts.repoDir,
          baseRef: `origin/${root.baseRefName}`,
          branches: decision.prs.map((pr) => ({
            name: pr.headRefName,
            expectedHeadOid: pr.headRefOid,
          })),
        });
        if (!result.ok) {
          return `skipped stack ${numbers}: ${result.reason}`;
        }
        const pushArgs = ["push", "--atomic"];
        for (const pr of decision.prs) {
          pushArgs.push(`--force-with-lease=${pr.headRefName}:${pr.headRefOid}`);
        }
        pushArgs.push("origin");
        for (const pr of decision.prs) {
          pushArgs.push(pr.headRefName);
        }
        await git(opts.repoDir, pushArgs);
        return `rebased stack ${numbers} onto ${root.baseRefName}`;
      } catch (error) {
        const message = error instanceof Error ? error.message : "stack rebase failed";
        return `skipped stack ${numbers}: ${message}`;
      }
    }
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}

async function fetchRefs(repoDir: string, refs: string[]): Promise<void> {
  const unique = [...new Set(refs)];
  await git(repoDir, ["fetch", "--quiet", "origin", ...unique]);
}

async function gh(args: string[]): Promise<string> {
  const result = await execFileAsync("gh", args, { encoding: "utf8" });
  return result.stdout;
}

async function git(repoDir: string, args: string[]): Promise<string> {
  const result = await execFileAsync("git", ["-C", repoDir, ...args], {
    encoding: "utf8",
  });
  return result.stdout.trim();
}

function parseJson(text: string): JsonValue {
  const parsed: JsonValue = JSON.parse(text);
  return parsed;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

await main();
