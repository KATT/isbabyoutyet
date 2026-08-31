import type { JsonValue } from "@workspace/runtime/json";
import { isJsonObjectValue, parseJsonNumber, parseJsonString } from "@workspace/runtime/json";

type CheckState = "passing" | "pending" | "failing";

type StatusCheck = {
  name: string;
  state: CheckState;
};

type MergeableState = "MERGEABLE" | "CONFLICTING" | "UNKNOWN";

export type ParsedPullRequest = {
  number: number;
  title: string;
  headRefName: string;
  baseRefName: string;
  headRefOid: string;
  baseRefOid: string;
  isDraft: boolean;
  isFromFork: boolean;
  autoMergeEnabled: boolean;
  mergeable: MergeableState;
  checks: StatusCheck[];
};

export type PullRequest = ParsedPullRequest & {
  behindBy: number;
};

type StackPr = {
  number: number;
  headRefName: string;
  headRefOid: string;
  baseRefName: string;
  baseRefOid: string;
};

export type KeepUpToDatePlanOptions = {
  requiredCheckNames: string[] | null;
};

export type KeepUpToDateDecision =
  | {
      action: "update-branch";
      prNumber: number;
      headRefName: string;
      headRefOid: string;
    }
  | {
      action: "rebase-stack";
      prs: StackPr[];
    }
  | {
      action: "skip";
      prNumbers: number[];
      reason: string;
    };

export function parseGhPullRequests(value: JsonValue): ParsedPullRequest[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of pull requests");
  }

  return value.map(parseGhPullRequest);
}

export function withBehindBy(pr: ParsedPullRequest, behindBy: number): PullRequest {
  return { ...pr, behindBy };
}

export function planKeepUpToDate(
  prs: PullRequest[],
  options: KeepUpToDatePlanOptions = { requiredCheckNames: null },
): KeepUpToDateDecision[] {
  const decisions: KeepUpToDateDecision[] = [];
  const groups = connectedGroups(prs).toSorted(compareGroups);

  for (const group of groups) {
    const decision = planGroup(group, options.requiredCheckNames);
    if (decision !== null) {
      decisions.push(decision);
    }
  }

  return keepOneMutation(decisions);
}

export function parseRequiredStatusCheckNames(value: JsonValue): string[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected an array of branch rules");
  }

  const names: string[] = [];
  for (const rule of value) {
    if (!isJsonObjectValue(rule)) {
      continue;
    }
    if (parseJsonString(rule["type"]) !== "required_status_checks") {
      continue;
    }
    const parameters = rule["parameters"];
    if (!isJsonObjectValue(parameters)) {
      continue;
    }
    const checks = parameters["required_status_checks"];
    if (!Array.isArray(checks)) {
      continue;
    }
    for (const check of checks) {
      if (!isJsonObjectValue(check)) {
        continue;
      }
      const context = parseJsonString(check["context"]);
      if (context !== null && context !== "") {
        names.push(context);
      }
    }
  }
  return names;
}

function parseGhPullRequest(value: JsonValue): ParsedPullRequest {
  if (!isJsonObjectValue(value)) {
    throw new Error("Expected a pull request object");
  }

  const number = parsePrNumber(value["number"]);
  const title = parseJsonString(value["title"]);
  const headRefName = parseJsonString(value["headRefName"]);
  const baseRefName = parseJsonString(value["baseRefName"]);
  const headRefOid = parseJsonString(value["headRefOid"]);
  const baseRefOid = parseJsonString(value["baseRefOid"]);
  if (
    title === null ||
    headRefName === null ||
    baseRefName === null ||
    headRefOid === null ||
    baseRefOid === null
  ) {
    throw new Error(`Pull request ${String(number)} is missing ref fields`);
  }

  return {
    number,
    title,
    headRefName,
    baseRefName,
    headRefOid,
    baseRefOid,
    isDraft: value["isDraft"] === true,
    isFromFork: value["isCrossRepository"] === true,
    autoMergeEnabled: isJsonObjectValue(value["autoMergeRequest"]),
    mergeable: parseMergeable(parseJsonString(value["mergeable"])),
    checks: parseChecks(value["statusCheckRollup"]),
  };
}

function parsePrNumber(value: JsonValue | undefined): number {
  if (value === undefined) {
    throw new Error("Pull request number must be an integer");
  }
  const number = parseJsonNumber(value);
  if (number === null || !Number.isInteger(number)) {
    throw new Error("Pull request number must be an integer");
  }
  return number;
}

function parseMergeable(value: string | null): MergeableState {
  if (value === "MERGEABLE" || value === "CONFLICTING" || value === "UNKNOWN") {
    return value;
  }
  return "UNKNOWN";
}

function parseChecks(value: JsonValue | undefined): StatusCheck[] {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value)) {
    throw new Error("statusCheckRollup must be an array");
  }
  return value.map(parseCheck);
}

function parseCheck(value: JsonValue): StatusCheck {
  if (!isJsonObjectValue(value)) {
    throw new Error("Expected a status check object");
  }

  const typename = parseJsonString(value["__typename"]);
  if (typename === "StatusContext") {
    const context = parseJsonString(value["context"]) ?? "status";
    const state = parseJsonString(value["state"]) ?? "";
    return { name: context, state: mapStatusContextState(state) };
  }

  const name = parseJsonString(value["name"]) ?? "check";
  const status = parseJsonString(value["status"]) ?? "";
  const conclusion = parseJsonString(value["conclusion"]) ?? "";
  return { name, state: mapCheckRunState(status, conclusion) };
}

function mapStatusContextState(state: string): CheckState {
  if (state === "SUCCESS") {
    return "passing";
  }
  if (state === "PENDING" || state === "EXPECTED") {
    return "pending";
  }
  return "failing";
}

function mapCheckRunState(status: string, conclusion: string): CheckState {
  if (status !== "COMPLETED") {
    return "pending";
  }
  if (conclusion === "SUCCESS" || conclusion === "SKIPPED" || conclusion === "NEUTRAL") {
    return "passing";
  }
  if (conclusion === "") {
    return "pending";
  }
  return "failing";
}

function connectedGroups(prs: PullRequest[]): PullRequest[][] {
  const byNumber = new Map<number, PullRequest>();
  for (const pr of prs) {
    byNumber.set(pr.number, pr);
  }

  const adjacency = new Map<number, Set<number>>();
  for (const pr of prs) {
    adjacency.set(pr.number, new Set());
  }
  for (const left of prs) {
    for (const right of prs) {
      if (left.number === right.number) {
        continue;
      }
      if (left.headRefName === right.baseRefName || right.headRefName === left.baseRefName) {
        adjacency.get(left.number)?.add(right.number);
      }
    }
  }

  const seen = new Set<number>();
  const groups: PullRequest[][] = [];
  for (const pr of prs) {
    if (seen.has(pr.number)) {
      continue;
    }
    const group: PullRequest[] = [];
    const queue = [pr.number];
    seen.add(pr.number);
    while (queue.length > 0) {
      const number = queue.shift();
      if (number === undefined) {
        break;
      }
      const current = byNumber.get(number);
      if (current === undefined) {
        continue;
      }
      group.push(current);
      for (const neighbor of adjacency.get(number) ?? []) {
        if (!seen.has(neighbor)) {
          seen.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
    groups.push(group);
  }
  return groups;
}

function compareGroups(left: PullRequest[], right: PullRequest[]): number {
  const leftIsStack = left.length > 1;
  const rightIsStack = right.length > 1;
  if (leftIsStack !== rightIsStack) {
    return leftIsStack ? -1 : 1;
  }
  return minPrNumber(left) - minPrNumber(right);
}

function minPrNumber(prs: PullRequest[]): number {
  let min = prs[0]?.number;
  if (min === undefined) {
    return 0;
  }
  for (const pr of prs) {
    if (pr.number < min) {
      min = pr.number;
    }
  }
  return min;
}

function planGroup(
  group: PullRequest[],
  requiredCheckNames: string[] | null,
): KeepUpToDateDecision | null {
  if (group.length > 1) {
    return planStack(group, requiredCheckNames);
  }
  const pr = group[0];
  if (pr === undefined) {
    return null;
  }
  return planSingle(pr, requiredCheckNames);
}

function planSingle(
  pr: PullRequest,
  requiredCheckNames: string[] | null,
): KeepUpToDateDecision | null {
  if (!pr.autoMergeEnabled) {
    return null;
  }
  if (pr.behindBy <= 0) {
    return null;
  }
  const blocker = singleBlocker(pr, requiredCheckNames);
  if (blocker !== null) {
    return { action: "skip", prNumbers: [pr.number], reason: blocker };
  }
  return {
    action: "update-branch",
    prNumber: pr.number,
    headRefName: pr.headRefName,
    headRefOid: pr.headRefOid,
  };
}

function planStack(
  group: PullRequest[],
  requiredCheckNames: string[] | null,
): KeepUpToDateDecision | null {
  if (!group.some((pr) => pr.autoMergeEnabled)) {
    return null;
  }

  if (hasDuplicateHeads(group)) {
    return {
      action: "skip",
      prNumbers: numbered(group),
      reason: "stack has duplicate head branches",
    };
  }

  const ordered = sortStack(group);
  if (ordered === null) {
    return {
      action: "skip",
      prNumbers: numbered(group),
      reason: "cyclic stack",
    };
  }

  if (!ordered.some((pr) => pr.behindBy > 0)) {
    return null;
  }

  const blocker = stackBlocker(ordered, requiredCheckNames);
  if (blocker !== null) {
    return { action: "skip", prNumbers: numbered(ordered), reason: blocker };
  }
  return {
    action: "rebase-stack",
    prs: ordered.map((pr) => ({
      number: pr.number,
      headRefName: pr.headRefName,
      headRefOid: pr.headRefOid,
      baseRefName: pr.baseRefName,
      baseRefOid: pr.baseRefOid,
    })),
  };
}

function sortStack(group: PullRequest[]): PullRequest[] | null {
  const byHead = new Map<string, PullRequest>();
  for (const pr of group) {
    byHead.set(pr.headRefName, pr);
  }

  const remaining = new Set(group);
  const ordered: PullRequest[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((pr) => {
        const parent = byHead.get(pr.baseRefName);
        return parent === undefined || ordered.includes(parent);
      })
      .toSorted((left, right) => left.number - right.number);
    const next = ready[0];
    if (next === undefined) {
      return null;
    }
    ordered.push(next);
    remaining.delete(next);
  }
  return ordered;
}

function singleBlocker(pr: PullRequest, requiredCheckNames: string[] | null): string | null {
  if (pr.isDraft) {
    return "draft pull request";
  }
  if (pr.isFromFork) {
    return "fork pull request";
  }
  if (pr.mergeable === "CONFLICTING") {
    return "merge conflict";
  }
  if (pr.mergeable === "UNKNOWN") {
    return "mergeability not computed yet";
  }
  if (!checksPassing(pr, requiredCheckNames)) {
    return "checks are not passing";
  }
  return null;
}

function stackBlocker(group: PullRequest[], requiredCheckNames: string[] | null): string | null {
  if (group.some((pr) => pr.isFromFork)) {
    return "stack includes a fork";
  }
  if (group.some((pr) => pr.isDraft)) {
    return "stack includes a draft";
  }
  if (group.some((pr) => pr.mergeable === "CONFLICTING")) {
    return "stack has a merge conflict";
  }
  if (group.some((pr) => pr.mergeable === "UNKNOWN")) {
    return "stack mergeability not computed yet";
  }
  if (group.some((pr) => !checksPassing(pr, requiredCheckNames))) {
    return "stack has a pull request whose checks are not passing";
  }
  return null;
}

function checksPassing(pr: PullRequest, requiredCheckNames: string[] | null): boolean {
  const required =
    requiredCheckNames === null || requiredCheckNames.length === 0
      ? pr.checks.map((check) => check.name)
      : requiredCheckNames;
  if (required.length === 0) {
    return false;
  }
  for (const name of required) {
    const check = pr.checks.find((candidate) => candidate.name === name);
    if (check === undefined || check.state !== "passing") {
      return false;
    }
  }
  return true;
}

function hasDuplicateHeads(group: PullRequest[]): boolean {
  const heads = new Set<string>();
  for (const pr of group) {
    if (heads.has(pr.headRefName)) {
      return true;
    }
    heads.add(pr.headRefName);
  }
  return false;
}

function keepOneMutation(decisions: KeepUpToDateDecision[]): KeepUpToDateDecision[] {
  let usedMutation = false;
  const limited: KeepUpToDateDecision[] = [];
  for (const decision of decisions) {
    if (decision.action === "skip") {
      limited.push(decision);
      continue;
    }
    if (usedMutation) {
      limited.push({
        action: "skip",
        prNumbers: mutationPrNumbers(decision),
        reason: "another eligible update is already running this cycle",
      });
      continue;
    }
    usedMutation = true;
    limited.push(decision);
  }
  return limited;
}

function mutationPrNumbers(decision: KeepUpToDateDecision): number[] {
  switch (decision.action) {
    case "update-branch":
      return [decision.prNumber];
    case "rebase-stack":
      return decision.prs.map((pr) => pr.number);
    case "skip":
      return decision.prNumbers;
    default: {
      const _exhaustive: never = decision;
      return _exhaustive;
    }
  }
}

function numbered(prs: PullRequest[]): number[] {
  return prs.map((pr) => pr.number);
}
