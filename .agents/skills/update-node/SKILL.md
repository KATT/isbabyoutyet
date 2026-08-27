---
name: update-node
description: >-
  Bump the repo Node.js major everywhere it is pinned. Use when upgrading Node,
  changing .nvmrc, engines.node, Convex nodeVersion, GitHub Actions setup-node,
  or fixing CI warnings that Node 20 actions are deprecated.
---

# Update Node.js

Current major: **24**. Edit every pin below in the same change.

| File | What to set |
| --- | --- |
| [`.nvmrc`](../../../.nvmrc) | The major (`24`). Source of truth for nvm/fnm and CI. |
| [`package.json`](../../../package.json) | `engines.node`: `^<major>.0.0` (pnpm + Vercel). |
| [`packages/convex/convex.json`](../../../packages/convex/convex.json) | `node.nodeVersion`: the major (Convex `"use node"` actions). |
| [`.github/workflows/main.yml`](../../../.github/workflows/main.yml) | Keep `node-version-file: .nvmrc`. Do not hardcode a second version. |
| [`pnpm-workspace.yaml`](../../../pnpm-workspace.yaml) | catalog `@types/node` only if types need a bump. |

Outside the repo: Vercel project Node.js Version, Cursor Cloud snapshot.

## GitHub Actions runtimes

Separate from the app Node `setup-node` installs. Each JavaScript action declares `runs.using` in its `action.yml`. A leftover `@v4` on `actions/checkout`, `actions/setup-node`, `actions/cache` (including `restore`/`save`), or `pnpm/action-setup` is what produces the CI warning that Node 20 is deprecated.

When GitHub deprecates an action runtime, bump those majors to releases whose `action.yml` says `node24` (or newer). Then `pnpm install` and `pnpm checks`.
