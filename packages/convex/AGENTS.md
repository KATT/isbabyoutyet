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

<!-- convex-ai-end -->

## Demo seed

Preview and local backends share `seed:seedDemoData` (login + babies in every
status, plus `test+newuser@example.com` with no babies) plus
`homepageDemo:refresh` once per locale (the public live-demo pages
linked from the homepage). Those babies are stored with `demo: true`; the
refresh mutation refuses to wipe any baby missing that flag (except grandfathering
the existing sentinel-owned Juniper Hale row). Local `setup-dev` seeds fixture
text first (`seed:data`); sharp resize + photo uploads run in the background
after `pnpm dev` starts (`dev:seed-photos-deferred`). Production/preview
deploys still run the full synchronous `seed:homepage`: dates shift to now and
visitor comments are wiped on each build.
When opening PRs, follow the root
[`AGENTS.md`](../../AGENTS.md) and link each seeded baby on the Vercel preview.
