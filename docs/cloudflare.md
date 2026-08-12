# Cloudflare Workers deployment

No custom domain or DNS route is declared in `wrangler.jsonc`, so setting up the
Worker does not change the main domain.

Pull requests deploy through GitHub Actions. Each PR gets its own Worker and
Convex preview. Closing the PR deletes both resources; the workflow fails loudly
if either deletion fails.

## One-time GitHub setup

Add these repository **Variables** under **Settings → Secrets and variables →
Actions → Variables**:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID |
| `CLOUDFLARE_WORKERS_SUBDOMAIN` | Account workers.dev subdomain, without `.workers.dev` |
| `CONVEX_PROJECT_ID` | Numeric Convex project ID |
| `VAPID_PUBLIC_KEY` | Existing VAPID public key |
| `VAPID_SUBJECT` | Optional; defaults to `mailto:admin@isbabyoutyet.com` |
| `EMAIL_FROM` | Optional until Email Service is onboarded |

Add these repository **Secrets**:

| Name | Value |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | Token with Account Settings Read, Workers Scripts Edit, User Details Read, and Memberships Read |
| `CONVEX_PREVIEW_DEPLOY_KEY` | Convex Preview Deploy Key |
| `CONVEX_MANAGEMENT_TOKEN` | Convex Team Access Token used only to delete closed-PR previews |
| `BETTER_AUTH_SECRET` | Stable secret of at least 32 high-entropy characters |
| `VAPID_PRIVATE_KEY` | Existing VAPID private key |
| `CLOUDFLARE_EMAIL_API_TOKEN` | Optional scoped token with **Email Sending: Edit** |

Create the Convex Team Access Token under **Team Settings → Access Tokens**.
The Management API is required because the Convex CLI cannot delete a preview
deployment.

Push or rerun the PR workflow after adding the settings. The
`Cloudflare preview` workflow posts a comment containing the absolute seeded
baby links. Fork pull requests are intentionally excluded because GitHub must
not expose Cloudflare and Convex deployment secrets to untrusted fork code.

## Preview lifecycle and billing

For PR 57 the resources are named:

- Worker: `isbabyoutyet-pr-57`
- Convex preview identifier: `cloudflare-pr-57`

The workflow uses full Worker deployments instead of persistent version aliases.
On the `pull_request.closed` event it:

1. runs `wrangler delete isbabyoutyet-pr-57 --force`, deleting the Worker and
   its static assets;
2. finds only the matching `preview` deployment through the documented Convex
   Management API and permanently deletes it;
3. reports a failed cleanup check if either operation fails.

Cloudflare Workers scale to zero, so an idle preview has no request charges even
before deletion. Explicit close-event deletion also prevents stale links from
receiving billable traffic. Convex previews expire automatically after 5 days
(14 days on higher plans), but the workflow deletes them immediately instead of
relying on that fallback.

This workflow must be present on `main` to guarantee cleanup for future PRs.
When testing the workflow on this infrastructure PR, merge it rather than
closing it unmerged so the `closed` event can run from the updated default
branch.

## Convex previews

Better Auth uses the Convex deployment's single `SITE_URL`. Sharing one Convex
deployment between different frontend origins would make builds overwrite the
auth origin. Cloudflare therefore uses `cloudflare-<branch>` Convex preview
names. Until the main domain is attached, the `main` workers.dev deployment uses
`cloudflare-main` rather than the production Convex deployment.

This requires a Convex plan that supports preview deployments and a Preview
Deploy Key from **Convex dashboard → Project Settings → Deploy Keys**.

## Password reset email

Password resets use Cloudflare Email Service's REST API from Convex. The REST
API is necessary because Better Auth runs in Convex rather than inside the
Worker, where a `send_email` binding would be available.

Cloudflare Email Sending is currently in public beta and requires the Workers
Paid plan to send to arbitrary recipients. It also requires Cloudflare DNS:

1. Open **Compute → Email Service → Email Sending**.
2. Onboard `isbabyoutyet.com`. This adds bounce MX, SPF, DKIM, and DMARC records
   but does not route web traffic or attach the domain to the Worker.
3. Create a scoped API token with **Email Sending: Edit**.
4. Add the Email Service secret and sender variable from the tables above.

Without those settings the app still builds and signs users in, but password
reset requests cannot send mail.

## Analytics and observability

Worker invocation metrics, structured logs, and automatic traces are enabled by
`wrangler.jsonc` and become available in the Worker's **Observability** tab.
No additional analytics service or application dependency is required.

After the custom domain is proxied through Cloudflare, add it under
**Analytics & Logs → Web Analytics**. Automatic setup injects Cloudflare's
privacy-first RUM beacon and reports Core Web Vitals without a code change.

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

1. Add `CONVEX_PRODUCTION_DEPLOY_KEY` as a GitHub Actions secret.
2. Add `CLOUDFLARE_PRODUCTION_SITE_URL=https://isbabyoutyet.com`.
3. Attach the custom domain to the Worker and update DNS.
4. Trigger a successful `main` build. The script will then deploy production
   Convex and set Better Auth's `SITE_URL` to the custom domain.
5. Verify login, signup, baby pages, manifest responses, push subscriptions,
   and service-worker assets before retiring the previous host.

Non-production branches continue to use `CONVEX_PREVIEW_DEPLOY_KEY` after the
cutover.
