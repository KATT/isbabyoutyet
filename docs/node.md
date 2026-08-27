# Node.js version

This repo runs on **Node.js 24**. Keep every pin on that major. Local tools,
CI, Vercel, Convex actions, and GitHub Actions JavaScript runtimes all need to
agree; a leftover Node 20 pin is how GitHub starts warning that Node 20 is
deprecated.

## Source of truth

[`.nvmrc`](../.nvmrc) is the app runtime pin (`24` = latest 24.x).

CI installs Node from that file (`node-version-file: .nvmrc`). Do not hardcode
a different `node-version` in workflows.

## Checklist (everywhere Node is referenced)

Update **all** of these when bumping the Node major.

### App runtime (must match `.nvmrc`)

| Location                                                                           | What it controls                                         |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [`.nvmrc`](../.nvmrc)                                                              | nvm, fnm, asdf (via nvm plugin), and GitHub `setup-node` |
| [`package.json`](../package.json) `engines.node`                                   | pnpm local installs; Vercel build image                  |
| [`packages/convex/convex.json`](../packages/convex/convex.json) `node.nodeVersion` | Convex `"use node"` actions                              |
| [`.github/workflows/main.yml`](../.github/workflows/main.yml) `setup-node`         | CI toolchain via `node-version-file: .nvmrc`             |

Root `engines.node` is `^24.0.0`. Workspace packages inherit it; do not add a
second, different `engines.node` under `apps/` or `packages/`.

### GitHub Actions _runtimes_ (separate from the app Node version)

GitHub runs each JavaScript action on the Node version declared in that
action's `action.yml` (`runs.using`). That is **not** the Node version
`setup-node` installs for `pnpm test`.

Node 20 action runtimes are deprecated
([changelog](https://github.blog/changelog/2025-09-19-deprecation-of-node-20-on-github-actions-runners/)).
A workflow that still uses `@v4` for first-party actions will log:

> Node.js 20 is deprecated. The following actions target Node.js 20 but are
> being forced to run on Node.js 24: `actions/checkout@v4`, …

Use Node 24 majors:

| Action                                       | Node 24 major                |
| -------------------------------------------- | ---------------------------- |
| `actions/checkout`                           | `@v7`                        |
| `actions/setup-node`                         | `@v7`                        |
| `actions/cache` (plus `restore` / `save`)    | `@v6`                        |
| `pnpm/action-setup`                          | `@v6`                        |
| `codecov/codecov-action`                     | `@v7`                        |
| `vercel/setup-turborepo-remote-cache-action` | `@v1.1.0` (already `node24`) |

When adding a new JavaScript action, open its `action.yml` and confirm
`runs.using: node24` (or a later Node). Composite/bash actions do not need a
Node runtime bump.

### Types (not the runtime)

| Location                                                              | What it controls        |
| --------------------------------------------------------------------- | ----------------------- |
| [`pnpm-workspace.yaml`](../pnpm-workspace.yaml) catalog `@types/node` | TypeScript `node` types |

`@types/node` may be ahead of the runtime (DefinitelyTyped ships a rolling
latest). Bump it when types are needed; do not treat it as the runtime pin.

### Outside the repo (confirm in dashboards)

| Place                                                                | What to check                                      |
| -------------------------------------------------------------------- | -------------------------------------------------- |
| Vercel → Project → Settings → Build and Deployment → Node.js Version | `24.x` (or “override from `package.json` engines”) |
| Cursor Cloud environment snapshot                                    | Install Node 24 so agents match `.nvmrc`           |
| Developer machines                                                   | `node -v` is 24.x after `nvm use` / `fnm use`      |

There is no `.node-version`, `.tool-versions`, Volta pin, Dockerfile, or
Wrangler Node compat flag in this repo. If you add one, list it here and point
it at the same major as `.nvmrc`.

## How to bump Node

1. Pick the new major (even current, e.g. 24 → 26). Confirm Convex still
   supports it for `node.nodeVersion`.
2. Set [`.nvmrc`](../.nvmrc) to that major.
3. Set root [`package.json`](../package.json) `engines.node` to `^<major>.0.0`.
4. Set [`packages/convex/convex.json`](../packages/convex/convex.json)
   `node.nodeVersion` to that major.
5. Leave CI on `node-version-file: .nvmrc`. Do not hardcode a second version.
6. If GitHub has deprecated the previous action runtime, bump JavaScript
   actions in [`.github/workflows/main.yml`](../.github/workflows/main.yml) to
   majors whose `action.yml` says `runs.using: node24` (or newer).
7. Bump catalog `@types/node` if the new runtime needs newer types.
8. Confirm Vercel and any Cursor Cloud snapshot use the new major.
9. Run `pnpm install` and `pnpm checks`.
10. Update this doc’s “Node.js 24” wording and the action-version table.

`scripts/nodePins.test.ts` fails if `.nvmrc`, `engines.node`, Convex
`nodeVersion`, CI `node-version-file`, or Node 20 action pins drift.
