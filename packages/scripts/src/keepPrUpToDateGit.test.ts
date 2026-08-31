import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { expect, test } from "vitest";
import { rebaseStackBranches } from "./keepPrUpToDateGit";

const execFileAsync = promisify(execFile);

test("rebases a linear stack onto an updated base", async () => {
  await using repo = await createGitRepo();
  await git(repo.dir, ["commit", "--allow-empty", "-m", "base-1"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "base.txt", contents: "one\n" });
  await git(repo.dir, ["add", "base.txt"]);
  await git(repo.dir, ["commit", "-m", "base-file"]);

  await git(repo.dir, ["checkout", "-b", "stack-1"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "a.txt", contents: "a\n" });
  await git(repo.dir, ["add", "a.txt"]);
  await git(repo.dir, ["commit", "-m", "a"]);
  const stack1 = await git(repo.dir, ["rev-parse", "HEAD"]);

  await git(repo.dir, ["checkout", "-b", "stack-2"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "b.txt", contents: "b\n" });
  await git(repo.dir, ["add", "b.txt"]);
  await git(repo.dir, ["commit", "-m", "b"]);
  const stack2 = await git(repo.dir, ["rev-parse", "HEAD"]);

  await git(repo.dir, ["checkout", "main"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "base.txt", contents: "one\ntwo\n" });
  await git(repo.dir, ["add", "base.txt"]);
  await git(repo.dir, ["commit", "-m", "base-2"]);
  const main = await git(repo.dir, ["rev-parse", "HEAD"]);

  const result = await rebaseStackBranches({
    repoDir: repo.dir,
    baseRef: "main",
    branches: [
      { name: "stack-1", expectedHeadOid: stack1 },
      { name: "stack-2", expectedHeadOid: stack2 },
    ],
  });

  expect(result).toEqual({ ok: true });
  expect(await git(repo.dir, ["merge-base", "--is-ancestor", main, "stack-1"])).toBe("");
  expect(await git(repo.dir, ["merge-base", "--is-ancestor", "stack-1", "stack-2"])).toBe("");
  expect(await showFile({ repoDir: repo.dir, filename: "base.txt", ref: "stack-2" })).toBe(
    "one\ntwo\n",
  );
  expect(await showFile({ repoDir: repo.dir, filename: "a.txt", ref: "stack-2" })).toBe("a\n");
  expect(await showFile({ repoDir: repo.dir, filename: "b.txt", ref: "stack-2" })).toBe("b\n");
});

test("aborts a stack rebase on conflict and leaves original SHAs", async () => {
  await using repo = await createGitRepo();
  await writeFileInRepo({ repoDir: repo.dir, filename: "file.txt", contents: "base\n" });
  await git(repo.dir, ["add", "file.txt"]);
  await git(repo.dir, ["commit", "-m", "base"]);

  await git(repo.dir, ["checkout", "-b", "stack-1"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "file.txt", contents: "feature\n" });
  await git(repo.dir, ["add", "file.txt"]);
  await git(repo.dir, ["commit", "-m", "feature"]);
  const stack1 = await git(repo.dir, ["rev-parse", "HEAD"]);

  await git(repo.dir, ["checkout", "-b", "stack-2"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "extra.txt", contents: "extra\n" });
  await git(repo.dir, ["add", "extra.txt"]);
  await git(repo.dir, ["commit", "-m", "extra"]);
  const stack2 = await git(repo.dir, ["rev-parse", "HEAD"]);

  await git(repo.dir, ["checkout", "main"]);
  await writeFileInRepo({ repoDir: repo.dir, filename: "file.txt", contents: "mainline\n" });
  await git(repo.dir, ["add", "file.txt"]);
  await git(repo.dir, ["commit", "-m", "mainline"]);

  const result = await rebaseStackBranches({
    repoDir: repo.dir,
    baseRef: "main",
    branches: [
      { name: "stack-1", expectedHeadOid: stack1 },
      { name: "stack-2", expectedHeadOid: stack2 },
    ],
  });

  expect(result).toEqual({ ok: false, reason: "conflict on stack-1" });
  expect(await git(repo.dir, ["rev-parse", "refs/heads/stack-1"])).toBe(stack1);
  expect(await git(repo.dir, ["rev-parse", "refs/heads/stack-2"])).toBe(stack2);
});

test("refuses to rebase when a branch head moved", async () => {
  await using repo = await createGitRepo();
  await git(repo.dir, ["checkout", "-b", "stack-1"]);
  await git(repo.dir, ["commit", "--allow-empty", "-m", "a"]);
  const stack1 = await git(repo.dir, ["rev-parse", "HEAD"]);
  await git(repo.dir, ["commit", "--allow-empty", "-m", "moved"]);

  const result = await rebaseStackBranches({
    repoDir: repo.dir,
    baseRef: "main",
    branches: [{ name: "stack-1", expectedHeadOid: stack1 }],
  });

  expect(result).toEqual({ ok: false, reason: "stale head on stack-1" });
});

async function createGitRepo() {
  const dir = await mkdtemp(join(tmpdir(), "keep-pr-up-to-date-"));
  await git(dir, ["init", "-b", "main"]);
  await git(dir, ["config", "user.email", "keep-up-to-date@example.test"]);
  await git(dir, ["config", "user.name", "Keep Up To Date"]);
  await git(dir, ["config", "commit.gpgsign", "false"]);
  await git(dir, ["config", "core.fsmonitor", "false"]);
  await git(dir, ["commit", "--allow-empty", "-m", "init"]);
  return makeAsyncResource({ dir }, async () => {
    await rm(dir, { recursive: true, force: true });
  });
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

async function writeFileInRepo(opts: { repoDir: string; filename: string; contents: string }) {
  await writeFile(join(opts.repoDir, opts.filename), opts.contents, "utf8");
}

async function showFile(opts: { repoDir: string; filename: string; ref: string }) {
  return `${await git(opts.repoDir, ["show", `${opts.ref}:${opts.filename}`])}\n`;
}

function makeAsyncResource<T>(thing: T, dispose: () => Promise<void>): T & AsyncDisposable {
  const resource = thing as T & AsyncDisposable;
  resource[Symbol.asyncDispose] = async () => {
    await dispose();
  };
  return resource;
}
