import { describe, expect, test } from "vitest";
import { parseGhPullRequests, planKeepUpToDate, type PullRequest } from "./keepPrUpToDate";

const passingChecks: PullRequest["checks"] = [{ name: "checks", state: "passing" }];

function pullRequest(overrides: Partial<PullRequest>): PullRequest {
  return {
    number: 1,
    title: "Change something",
    headRefName: "feat/one",
    baseRefName: "main",
    headRefOid: "sha-1",
    baseRefOid: "sha-main",
    isDraft: false,
    isFromFork: false,
    autoMergeEnabled: true,
    mergeable: "MERGEABLE",
    behindBy: 1,
    checks: passingChecks,
    ...overrides,
  };
}

function plannedActions(prs: PullRequest[]) {
  return planKeepUpToDate(prs).map((decision) => {
    switch (decision.action) {
      case "update-branch":
        return { action: decision.action, prNumber: decision.prNumber };
      case "rebase-stack":
        return {
          action: decision.action,
          prNumbers: decision.prs.map((pr) => pr.number),
        };
      case "skip":
        return {
          action: decision.action,
          prNumbers: decision.prNumbers,
          reason: decision.reason,
        };
      default: {
        const _exhaustive: never = decision;
        return _exhaustive;
      }
    }
  });
}

describe("planKeepUpToDate", () => {
  test("updates a passing auto-merge PR that is behind with no conflict", () => {
    expect(plannedActions([pullRequest({})])).toEqual([{ action: "update-branch", prNumber: 1 }]);
  });

  test("ignores PRs without auto-merge", () => {
    expect(plannedActions([pullRequest({ autoMergeEnabled: false })])).toEqual([]);
  });

  test("does not touch an up-to-date auto-merge PR", () => {
    expect(plannedActions([pullRequest({ behindBy: 0 })])).toEqual([]);
  });

  test("skips drafts, forks, conflicts, unknown mergeability, and failing or pending builds", () => {
    expect(plannedActions([pullRequest({ isDraft: true })])).toEqual([
      { action: "skip", prNumbers: [1], reason: "draft pull request" },
    ]);
    expect(plannedActions([pullRequest({ isFromFork: true })])).toEqual([
      { action: "skip", prNumbers: [1], reason: "fork pull request" },
    ]);
    expect(plannedActions([pullRequest({ mergeable: "CONFLICTING" })])).toEqual([
      { action: "skip", prNumbers: [1], reason: "merge conflict" },
    ]);
    expect(plannedActions([pullRequest({ mergeable: "UNKNOWN" })])).toEqual([
      {
        action: "skip",
        prNumbers: [1],
        reason: "mergeability not computed yet",
      },
    ]);
    expect(
      plannedActions([pullRequest({ checks: [{ name: "checks", state: "failing" }] })]),
    ).toEqual([{ action: "skip", prNumbers: [1], reason: "checks are not passing" }]);
    expect(
      plannedActions([pullRequest({ checks: [{ name: "checks", state: "pending" }] })]),
    ).toEqual([{ action: "skip", prNumbers: [1], reason: "checks are not passing" }]);
    expect(plannedActions([pullRequest({ checks: [] })])).toEqual([
      { action: "skip", prNumbers: [1], reason: "checks are not passing" },
    ]);
  });

  test("treats skipped and neutral checks as passing, including Vercel statuses", () => {
    expect(
      plannedActions([
        pullRequest({
          checks: [
            { name: "checks", state: "passing" },
            { name: "codecov", state: "passing" },
            { name: "Vercel", state: "passing" },
          ],
        }),
      ]),
    ).toEqual([{ action: "update-branch", prNumber: 1 }]);
  });

  test("rebases a whole stack instead of updating each PR with a merge commit", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      baseRefName: "main",
      headRefOid: "sha-10",
    });
    const mid = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      headRefOid: "sha-11",
      behindBy: 0,
    });
    const tip = pullRequest({
      number: 12,
      headRefName: "stack/3",
      baseRefName: "stack/2",
      headRefOid: "sha-12",
      behindBy: 0,
      autoMergeEnabled: false,
    });

    expect(plannedActions([tip, mid, root])).toEqual([
      { action: "rebase-stack", prNumbers: [10, 11, 12] },
    ]);
  });

  test("skips the whole stack when any member cannot be rebased", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      baseRefName: "main",
      headRefOid: "sha-10",
    });
    const tip = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      headRefOid: "sha-11",
      mergeable: "CONFLICTING",
    });

    expect(plannedActions([root, tip])).toEqual([
      { action: "skip", prNumbers: [10, 11], reason: "stack has a merge conflict" },
    ]);
  });

  test("skips the whole stack when a member's checks are not passing", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      baseRefName: "main",
      headRefOid: "sha-10",
    });
    const tip = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      headRefOid: "sha-11",
      checks: [{ name: "checks", state: "failing" }],
    });

    expect(plannedActions([root, tip])).toEqual([
      {
        action: "skip",
        prNumbers: [10, 11],
        reason: "stack has a pull request whose checks are not passing",
      },
    ]);
  });

  test("skips the whole stack when a member is a fork or draft", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      headRefOid: "sha-10",
    });
    const forkTip = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      headRefOid: "sha-11",
      isFromFork: true,
    });
    expect(plannedActions([root, forkTip])).toEqual([
      { action: "skip", prNumbers: [10, 11], reason: "stack includes a fork" },
    ]);

    const draftTip = pullRequest({
      number: 12,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      headRefOid: "sha-12",
      isDraft: true,
    });
    expect(plannedActions([root, draftTip])).toEqual([
      { action: "skip", prNumbers: [10, 12], reason: "stack includes a draft" },
    ]);
  });

  test("does not rebase a stack that has no auto-merge PR", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      autoMergeEnabled: false,
    });
    const tip = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      autoMergeEnabled: false,
    });
    expect(plannedActions([root, tip])).toEqual([]);
  });

  test("does not rebase an up-to-date stack", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      behindBy: 0,
    });
    const tip = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      behindBy: 0,
    });
    expect(plannedActions([root, tip])).toEqual([]);
  });

  test("rebases a tree stack in topological order", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      headRefOid: "sha-10",
    });
    const left = pullRequest({
      number: 11,
      headRefName: "stack/2a",
      baseRefName: "stack/1",
      headRefOid: "sha-11",
      behindBy: 0,
    });
    const right = pullRequest({
      number: 12,
      headRefName: "stack/2b",
      baseRefName: "stack/1",
      headRefOid: "sha-12",
      behindBy: 0,
    });

    expect(plannedActions([right, left, root])).toEqual([
      { action: "rebase-stack", prNumbers: [10, 11, 12] },
    ]);
  });

  test("skips a cyclic stack", () => {
    const left = pullRequest({
      number: 10,
      headRefName: "cycle/a",
      baseRefName: "cycle/b",
    });
    const right = pullRequest({
      number: 11,
      headRefName: "cycle/b",
      baseRefName: "cycle/a",
    });
    expect(plannedActions([left, right])).toEqual([
      { action: "skip", prNumbers: [10, 11], reason: "cyclic stack" },
    ]);
  });

  test("plans a stack rebase and a separate single update together", () => {
    const root = pullRequest({
      number: 10,
      headRefName: "stack/1",
      headRefOid: "sha-10",
    });
    const tip = pullRequest({
      number: 11,
      headRefName: "stack/2",
      baseRefName: "stack/1",
      headRefOid: "sha-11",
      behindBy: 0,
    });
    const single = pullRequest({
      number: 20,
      headRefName: "feat/alone",
      headRefOid: "sha-20",
    });

    expect(plannedActions([single, tip, root])).toEqual([
      { action: "rebase-stack", prNumbers: [10, 11] },
      { action: "update-branch", prNumber: 20 },
    ]);
  });
});

describe("parseGhPullRequests", () => {
  test("reads auto-merge, fork, mergeable, and mixed check-run/status-context rollup", () => {
    const prs = parseGhPullRequests([
      {
        number: 265,
        title: "Keep PRs up to date",
        headRefName: "cursor/keep-prs-up-to-date-719e",
        baseRefName: "main",
        headRefOid: "abc123",
        baseRefOid: "mainsha",
        isDraft: false,
        isCrossRepository: false,
        autoMergeRequest: { enabledAt: "2026-08-31T00:00:00Z" },
        mergeable: "MERGEABLE",
        statusCheckRollup: [
          {
            __typename: "CheckRun",
            name: "checks",
            status: "IN_PROGRESS",
            conclusion: "",
          },
          {
            __typename: "StatusContext",
            context: "Vercel",
            state: "PENDING",
          },
          {
            __typename: "CheckRun",
            name: "Vercel Preview Comments",
            status: "COMPLETED",
            conclusion: "SUCCESS",
          },
        ],
      },
    ]);

    expect(prs).toEqual([
      {
        number: 265,
        title: "Keep PRs up to date",
        headRefName: "cursor/keep-prs-up-to-date-719e",
        baseRefName: "main",
        headRefOid: "abc123",
        baseRefOid: "mainsha",
        isDraft: false,
        isFromFork: false,
        autoMergeEnabled: true,
        mergeable: "MERGEABLE",
        checks: [
          { name: "checks", state: "pending" },
          { name: "Vercel", state: "pending" },
          { name: "Vercel Preview Comments", state: "passing" },
        ],
      },
    ]);
  });

  test("maps skipped and failed conclusions and missing auto-merge", () => {
    const prs = parseGhPullRequests([
      {
        number: 1,
        title: "Forked",
        headRefName: "fork-branch",
        baseRefName: "main",
        headRefOid: "def",
        baseRefOid: "mainsha",
        isDraft: true,
        isCrossRepository: true,
        autoMergeRequest: null,
        mergeable: "CONFLICTING",
        statusCheckRollup: [
          {
            __typename: "CheckRun",
            name: "checks",
            status: "COMPLETED",
            conclusion: "SKIPPED",
          },
          {
            __typename: "CheckRun",
            name: "lint",
            status: "COMPLETED",
            conclusion: "FAILURE",
          },
          {
            __typename: "StatusContext",
            context: "Vercel",
            state: "SUCCESS",
          },
        ],
      },
    ]);

    expect(prs[0]).toMatchObject({
      isDraft: true,
      isFromFork: true,
      autoMergeEnabled: false,
      mergeable: "CONFLICTING",
      checks: [
        { name: "checks", state: "passing" },
        { name: "lint", state: "failing" },
        { name: "Vercel", state: "passing" },
      ],
    });
  });
});
