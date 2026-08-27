# Agent notes (`.agents`)

Project skills live under [`.agents/skills/`](skills/).

## Node.js

To bump the Node major (`.nvmrc`, `engines`, Convex, CI action runtimes), follow
[`update-node/SKILL.md`](skills/update-node/SKILL.md).

## Route loaders

When adding or changing TanStack Router loaders or SSR prefetch, follow
[`no-loader-waterfalls/SKILL.md`](skills/no-loader-waterfalls/SKILL.md).
Independent queries must prefetch in parallel — no loader waterfalls.

- **404 / redirect / locale** → `beforeLoad` only (never duplicate `notFound()` in the loader)
- **Prefetch** → one parallel `allKeyed` in `loader`, using route params directly
