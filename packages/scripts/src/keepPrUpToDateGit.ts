import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type StackBranch = {
  name: string;
  expectedHeadOid: string;
};

export type RebaseStackRequest = {
  repoDir: string;
  baseRef: string;
  branches: StackBranch[];
};

export type RebaseStackResult = { ok: true } | { ok: false; reason: string };

export async function rebaseStackBranches(request: RebaseStackRequest): Promise<RebaseStackResult> {
  if (request.branches.length === 0) {
    return { ok: false, reason: "empty stack" };
  }

  for (const branch of request.branches) {
    const actual = await git(request.repoDir, [
      "rev-parse",
      "--verify",
      `refs/heads/${branch.name}`,
    ]);
    if (actual !== branch.expectedHeadOid) {
      return { ok: false, reason: `stale head on ${branch.name}` };
    }
  }

  let previousBranch = request.baseRef;
  for (const branch of request.branches) {
    await git(request.repoDir, ["checkout", "--quiet", branch.name]);
    const rebased = await tryRebase(request.repoDir, previousBranch);
    if (!rebased) {
      await restoreBranches(request.repoDir, request.branches);
      return { ok: false, reason: `conflict on ${branch.name}` };
    }
    previousBranch = branch.name;
  }

  return { ok: true };
}

async function tryRebase(repoDir: string, onto: string): Promise<boolean> {
  try {
    await git(repoDir, ["rebase", onto]);
    return true;
  } catch {
    await git(repoDir, ["rebase", "--abort"]).catch(() => undefined);
    return false;
  }
}

async function restoreBranches(repoDir: string, branches: StackBranch[]): Promise<void> {
  await git(repoDir, ["rebase", "--abort"]).catch(() => undefined);
  for (const branch of branches) {
    await git(repoDir, ["update-ref", `refs/heads/${branch.name}`, branch.expectedHeadOid]);
  }
}

async function git(repoDir: string, args: string[]): Promise<string> {
  const result = await execFileAsync(
    "git",
    ["-C", repoDir, "-c", "commit.gpgsign=false", "-c", "core.fsmonitor=false", ...args],
    {
      encoding: "utf8",
    },
  );
  return result.stdout.trim();
}
