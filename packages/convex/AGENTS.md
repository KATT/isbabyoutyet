<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

For **schema changes on deployed apps** (remove fields, tighten validators,
stacked migration PRs), read
[`.agents/skills/convex-schema-migration/SKILL.md`](.agents/skills/convex-schema-migration/SKILL.md)
before editing `schema.ts` or `migrations.ts`.

`v.optional()` on schema fields and RPC args is a migration transient only.
Undocumented optionals fail `workspace/no-undocumented-optional`;
mark remaining optionals with JSDoc `@todo` (they are still in use), then
backfill and require the key. See
[`.agents/skills/convex-schema-migration/SKILL.md`](.agents/skills/convex-schema-migration/SKILL.md).

<!-- convex-ai-end -->

## Demo seed

Preview and local backends share `seed:seedDemoData` (login + babies in every
status, plus `test+newuser@example.com` with no babies) plus
`homepageDemo:refresh` once per locale (the public live-demo pages
linked from the homepage). Those babies are stored with `demo: true`; the
refresh mutation also requires a reserved homepage publicId plus the sentinel
owner user/token, and only grandfathers the existing pre-flag Juniper Hale row.
Resetting deletes only those babies' feed documents and never deletes storage
objects, whose IDs may be reused by non-demo data. Local `setup-dev` seeds fixture
text first (`seed:data`); sharp resize + photo uploads run in the background
after `pnpm dev` starts (`dev:seed-photos-deferred`). Production/preview
deploys run `seed:homepage` as an idempotent bootstrap: an existing complete
fixture feed is the photo sentinel, so builds do not reset dates, wipe visitor
encouragements, or reupload photos. `crons.ts` checks daily and resets every
locale independently when that baby has no real visitor encouragement from the
previous hour.
When opening PRs, follow the root
[`AGENTS.md`](../../AGENTS.md) and link each seeded baby on the Vercel preview.
