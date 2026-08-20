# Agent notes

## Routing / scroll / overlays

Baby settings (`/baby/$publicId/settings`), post-update (`/baby/$publicId/post`),
and photo lightboxes (`/baby/$publicId/photo`,
`/baby/$publicId/updates/$updateId/photo`) are nested child routes rendered into
the baby layout `<Outlet />` so the page stays mounted underneath. Photo route
loaders prefetch the full image in the browser via `prefetchBrowserImage`
(same initiator pattern as notification push capability).

Use `@/lib/overlay-nav` for open/close (TanStack has `history.back` /
`canGoBack` and `linkOptions`, but no overlay-history helper):

- **Open link:** `openOverlayLink({ to, params, ... })` — push (no `replace`),
  `resetScroll: false`, and `state: { overlay: true }`. Pass to `<Link>` or
  `navigate()`.
- **Close link:** `closeOverlayLink({ to, params, ... })` — replace close
  target with `resetScroll: false` (declarative fallback / cold-load close).
- **Hook:** `useOverlayNav({ open, close })` returns `{ openLink, closeLink,
  dismiss }`. `dismiss()` calls `history.back()` when the entry was push-opened
  and `canGoBack()`; otherwise navigates with `closeLink`.
- Close overlay dialogs via `onOpenChange` → `onOpenChangeComplete` so the exit
  animation finishes before dismissing.

Keep `replace: true` for slug canonicalize and auth redirects. Admin tab switches
still use `resetScroll: false` (not overlay history).

## Convex

When working under `packages/convex/`, also follow
[`packages/convex/AGENTS.md`](packages/convex/AGENTS.md).

For route loaders and other project skills, see
[`.agents/AGENTS.md`](.agents/AGENTS.md).

## Pull requests

Fill every section in [`.github/pull_request_template.md`](.github/pull_request_template.md).
For stacked PRs, also follow
[`.agents/skills/create-stacked-prs/SKILL.md`](.agents/skills/create-stacked-prs/SKILL.md).

### Screenshots and video

- Every PR includes the `## Screenshots / video` section from the template.
- For user-visible UI changes, attach screenshots of the important final states.
  Use before/after screenshots when the difference is not obvious from the final
  state alone.
- For interactions, animations, or multi-step flows, attach a short video that
  starts immediately before the demonstration and ends immediately after it.
- Use the smallest artifact set that proves the change. Do not include failed
  runs, setup steps, stale UI, redundant captures, or sensitive data.
- Capture artifacts from the final tested preview revision and remove references
  to superseded artifacts when the UI changes.
- If visual evidence is not applicable, write `None — <brief reason>` instead of
  omitting the section.
