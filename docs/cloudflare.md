# Cloudflare Workers deployment

No custom domain or DNS route is declared in `wrangler.jsonc`, so setting up the
Worker does not change the main domain.

The app uses Workers Builds rather than Pages. Workers Builds supports TanStack
Start SSR and creates both a commit URL and a stable branch URL for every pull
request.

## One-time dashboard setup

1. In **Workers & Pages**, create a Worker by importing this GitHub repository.
2. Set the production branch to `main` and the root directory to `apps/web`.
3. Configure these build commands:

   | Setting | Command |
   | --- | --- |
   | Build command | `pnpm deploy-convex` |
   | Deploy command | `pnpm exec wrangler deploy` |
   | Non-production branch deploy command | `pnpm exec wrangler versions upload` |

4. Enable builds for all non-production branches and leave pull request
   comments enabled. Cloudflare will post stable branch and commit preview URLs
   to each pull request.
5. Add these **build** variables and secrets (not Worker runtime variables):

   | Name | Type | Value |
   | --- | --- | --- |
   | `CLOUDFLARE_WORKERS_SUBDOMAIN` | Variable | The account's workers.dev subdomain, without `.workers.dev` |
   | `CONVEX_PREVIEW_DEPLOY_KEY` | Secret | A Convex Preview Deploy Key |
   | `BETTER_AUTH_SECRET` | Secret | The same application secret used by the existing deployment |
   | `VAPID_PUBLIC_KEY` | Variable | The existing VAPID public key |
   | `VAPID_PRIVATE_KEY` | Secret | The existing VAPID private key |
   | `VAPID_SUBJECT` | Variable | Optional; defaults to `mailto:admin@isbabyoutyet.com` |

Workers Builds supplies `WORKERS_CI` and `WORKERS_CI_BRANCH` automatically. The
build script derives the same stable branch alias as Wrangler, configures that
URL as `SITE_URL`, deploys a provider-specific Convex preview, seeds its demo
data, runs migrations, and builds the Worker.

## Convex previews

Better Auth uses the Convex deployment's single `SITE_URL`. Sharing one Convex
deployment between different frontend origins would make builds overwrite the
auth origin. Cloudflare therefore uses `cloudflare-<branch>` Convex preview
names. Until the main domain is attached, the `main` workers.dev deployment uses
`cloudflare-main` rather than the production Convex deployment.

This requires a Convex plan that supports preview deployments and a Preview
Deploy Key from **Convex dashboard → Project Settings → Deploy Keys**.

## Local verification

The normal development, build, and preview commands use the Workers runtime:

```sh
pnpm --filter web dev
pnpm --filter web build
pnpm --filter web preview
```

Those commands require the normal `VITE_CONVEX_URL`,
`VITE_CONVEX_SITE_URL`, and `VITE_SITE_URL` values. The full
`pnpm deploy-convex` flow is intended for CI because it requires deployment
keys and deploys a Convex backend.

## Domain cutover later

Do not add these settings during parallel deployment. At cutover:

1. Add `CONVEX_PRODUCTION_DEPLOY_KEY` as a Workers Builds secret.
2. Add `CLOUDFLARE_PRODUCTION_SITE_URL=https://isbabyoutyet.com`.
3. Attach the custom domain to the Worker and update DNS.
4. Trigger a successful `main` build. The script will then deploy production
   Convex and set Better Auth's `SITE_URL` to the custom domain.
5. Verify login, signup, baby pages, manifest responses, push subscriptions,
   and service-worker assets before retiring the previous host.

Non-production branches continue to use `CONVEX_PREVIEW_DEPLOY_KEY` after the
cutover.
