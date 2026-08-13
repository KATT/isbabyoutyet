# Agent notes

## Pull requests — always link the seeded demo babies

Every preview deployment is seeded with a demo login, four babies in every
status, and the public homepage demo baby (see
[`packages/convex/src/seedCredentials.ts`](packages/convex/src/seedCredentials.ts)
and [`packages/convex/convex/seed.ts`](packages/convex/convex/seed.ts)).

**When creating or updating a PR, always include a "Demo seed" section** near
the top of the description with:

1. The demo login (`test@example.com` / `password`)
2. Absolute markdown links to each seeded baby on **this PR's Vercel preview**

Resolve the preview base URL from the Vercel bot comment on the PR (the
branch alias like `https://isbabyoutyet-git-…-alex-katts-projects.vercel.app`),
not the ephemeral deployment-hash `*.vercel.app` URL. Baby paths are
`/baby/{publicId}` using the `publicId` values from `DEMO_BABIES` and
`HOMEPAGE_DEMO_BABY`.

### Template (replace `{preview}` with the branch preview origin)

```markdown
## Demo seed

Login: `test@example.com` / `password`

| Status | Preview |
| --- | --- |
| Live demo (Juniper) | [{preview}/baby/juniper]({preview}/baby/juniper) |
| Not yet | [{preview}/baby/baby-waiting]({preview}/baby/baby-waiting) |
| Labour started | [{preview}/baby/baby-in-labor]({preview}/baby/baby-in-labor) |
| Gone to hospital | [{preview}/baby/baby-at-hospital]({preview}/baby/baby-at-hospital) |
| Born | [{preview}/baby/baby-born]({preview}/baby/baby-born) |
```

If the preview is not up yet, still include the section and note that links
will work once Vercel finishes deploying, then update the PR once the URL is
known.

Locally the same seed is at `http://localhost:3000` after
`pnpm --filter @workspace/convex seed` (also run by `setup-dev`). Login and
signup forms autofill the demo credentials in local DEV and on Vercel preview
builds (`VITE_HAS_DEMO_LOGIN`).

The homepage live demo (`/baby/juniper`) is also seeded in production. Each
production deploy refreshes its dates and wipes visitor comments.

## Convex

When working under `packages/convex/`, also follow
[`packages/convex/AGENTS.md`](packages/convex/AGENTS.md).
