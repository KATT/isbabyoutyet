# Agent notes

## React hooks policy (`useEffect` / local state)

Feature code under `apps/web/src/components` and `apps/web/src/routes` must not
use `useEffect` / `useLayoutEffect`, nor local-state hooks (`useState`,
`useReducer`, `useActionState`, `useOptimistic`). Prefer:

- **URL / nested routes** for shareable UI (overlays, tabs, lightboxes)
- **Queries / mutations / `useTransition`** for server data and pending UI
- **Uncontrolled triggers** (`PopoverTrigger`, `DialogTrigger`, `DrawerTrigger`)
  for settings editors and similar ephemeral open/close

### `apps/web/src/lib` audited seams

Lib may use effects and local state when the hook is a **reusable seam** that
owns cleanup for an external system (timers, observers, blob URLs, module
stores). Checklist before adding a lib hook with `useEffect` / `useState`:

1. **Reusable** — at least one clear consumer pattern, not a single feature’s
   private lifecycle parked to dodge the ban
2. **Documented** — file comment states what external system it syncs
3. **Tested** when timing or subscription behavior is non-trivial
4. **No re-export** of banned React hooks (`no-banned-react-reexport`)

`packages/ui` (vendored shadcn) is exempt. First-party packages stay under the
rules; rare file overrides need a comment citing the concrete constraint.

## Routing / scroll / overlays

Baby settings (`/baby/$publicId/settings`), post-update (`/baby/$publicId/post`),
share preview (`/baby/$publicId/share`), and photo lightboxes (`/baby/$publicId/photo`,
`/baby/$publicId/updates/$updateId/photo`) are nested child routes rendered into
the baby layout `<Outlet />` so the page stays mounted underneath. Share and
photo route loaders prefetch their full image in the browser via
`prefetchBrowserImage` (same initiator pattern as notification push capability).

Use `@/lib/overlay-nav` for open/close (TanStack has `history.back` /
`canGoBack` and `linkOptions`, but no overlay-history helper):

- **Open link:** `openOverlayLink({ to, params, ... })` — push (no `replace`),
 viewport preload, `resetScroll: false`, and `state: { overlay: true }`. Prefer
 passing it to a real `<Link>` so the child route loader runs before click;
 `navigate()` is reserved for imperative flows.
- **Close link:** `closeOverlayLink({ to, params, ... })` — replace close
  target with `resetScroll: false` (declarative fallback / cold-load close).
- **Hook:** `useOverlayNav({ open, close })` returns `{ openLink, closeLink,
  dismiss }`. `dismiss()` calls `history.back()` when the entry was push-opened
  and `canGoBack()`; otherwise navigates with `closeLink`.
- Close overlay dialogs via `onOpenChange` → `onOpenChangeComplete` so the exit
  animation finishes before dismissing.

Keep `replace: true` for slug canonicalize and auth redirects. Admin tab switches
still use `resetScroll: false` (not overlay history).

## Tests

`vi.mock` / `vi.hoisted` / `vi.doMock` (and the `jest` equivalents) are banned
repo-wide by the `no-mock` oxlint plugin. Build a seam instead:

- **Components:** export a presentational `…View` marked `@internal` and pass
  data plus handlers as props; keep query/mutation wiring in the container.
- **Server handlers / guards:** take the effectful dependency as a parameter
  (`handleCachePurge(request, { deleteByTag })`,
  `resolveAuthGuard({ context, fetchToken })`).
- **Routing:** render under a real memory router — `renderWithTestRouter` /
  `renderWithOverlayRouter` — rather than stubbing `@tanstack/react-router`.
- **Convex / React Query:** prefer `createConvexTestHarness` +
  `renderWithConvexTest`, `renderMountedFileRoute`, and `runRouteLoader` /
  `runRouteBeforeLoad` so components and file routes hit the in-memory
  `convex-test` backend (seed with `seedOwnedBaby` / `signUpTestUser` /
  `seedBabyWithPhoto`, switch callers via `harness.withIdentity`). Avoid
  hand-built handler maps and production `*View` / DI props when integration
  tests can mount the real component. Wrap in the real `ConvexProvider` /
  `QueryClientProvider`.
- **Convex stub lint:** `no-convex-stubs/no-invalid-convex-client` bans
  `new ConvexReactClient("https://example.invalid")` in web tests;
  `no-convex-stubs/no-test-preloaded-query` bans
  `@workspace/convex-prefetch/test-helpers` fake handles.
- **Everything else:** `vi.fn` and `vi.spyOn` are still fine (e.g. spying on
  `sonner`'s `toast` methods). Browser API gaps belong in
  `apps/web/src/test/setup.ts`.

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
