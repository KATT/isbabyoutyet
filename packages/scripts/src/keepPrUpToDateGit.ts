import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

type StackBranch = {
  name: string;
  expectedHeadOid: string;
  oldParentOid: string;
  baseRefName: string;
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

  const stackHeads = new Set(request.branches.map((branch) => branch.name));
  for (const branch of request.branches) {
    const onto = stackHeads.has(branch.baseRefName) ? branch.baseRefName : request.baseRef;
    const rebased = await tryRebase({
      repoDir: request.repoDir,
      onto,
      oldParentOid: branch.oldParentOid,
      branch: branch.name,
    });
    if (!rebased) {
      await restoreBranches(request.repoDir, request.branches);
      return { ok: false, reason: `conflict on ${branch.name}` };
    }
  }

  return { ok: true };
}

async function tryRebase(opts: {
  repoDir: string;
  onto: string;
  oldParentOid: string;
  branch: string;
}): Promise<boolean> {
  try {
    await git(opts.repoDir, ["rebase", "--onto", opts.onto, opts.oldParentOid, opts.branch]);
    return true;
  } catch {
    await git(opts.repoDir, ["rebase", "--abort"]).catch(() => undefined);
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
