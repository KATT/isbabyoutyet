# Agent notes (`.agents`)

Project skills live under [`.agents/skills/`](skills/).

## Route loaders

When adding or changing TanStack Router loaders or SSR prefetch, follow
[`no-loader-waterfalls/SKILL.md`](skills/no-loader-waterfalls/SKILL.md).
Independent queries must prefetch in parallel — no loader waterfalls.

- **404 / redirect / locale** → `beforeLoad` only (never duplicate `notFound()` in the loader)
- **Prefetch** → one parallel `allKeyed` in `loader`, using route params directly

## Overlay forms

When adding a Save/Cancel form in a dialog, popover, sheet, or nested route
overlay, follow the form-guard rules in the root `AGENTS.md` (`useFormGuard` +
`Form`, close with `guard.close()`, never `DialogClose` that also submits).
