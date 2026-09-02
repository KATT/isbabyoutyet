# Transactional email (Cloudflare Email Service)

Password resets (and future transactional mail) go through an `EmailSender`
port in Convex. Local backends always log. Vercel production and preview use
Cloudflare Email Service's REST API.

Better Auth already rate-limits `/request-password-reset` (3 requests / 60s)
and related auth endpoints. This app enables Better Auth's database-backed
rate limiter on preview and production so limits survive across Convex
isolates.

## What ships in this PR

- Password-reset UI at `/auth/forgot-password` and `/auth/reset-password`
- Cloudflare Email Service adapter + shared password-reset template
- Log adapter for local development (no real mail)
- Preview mail from `preview@isbabyoutyet.com` with a `[Preview]` subject
  prefix; production from `noreply@isbabyoutyet.com`
- Deploy script syncs optional email env vars onto Convex when present

## Finish guide (one-time human setup)

Do these outside the repo before password-reset mail works on previews or
production.

### 1. Onboard the domain in Cloudflare

1. Cloudflare dashboard → **Email Service → Email Sending**.
2. Onboard `isbabyoutyet.com`. Cloudflare adds bounce MX, SPF, DKIM, and
   DMARC. This does **not** move web traffic.
3. Confirm both sender addresses can send:
   - `noreply@isbabyoutyet.com` (production)
   - `preview@isbabyoutyet.com` (Vercel previews)

Workers Paid is required to send to arbitrary recipients (Email Sending public
beta). Until the domain is onboarded you can only send to verified destination
addresses in the Cloudflare account.

### 2. Create an API token

Create a scoped Cloudflare API token with **Email Sending: Edit**. Prefer a
token that cannot edit Workers or DNS.

### 3. Add Vercel environment variables

Set these on the Vercel project for **Preview** and **Production** (the deploy
script copies them into the matching Convex deployment):

| Name | Required | Value |
| --- | --- | --- |
| `CLOUDFLARE_ACCOUNT_ID` | yes (to send) | Cloudflare account ID |
| `CLOUDFLARE_EMAIL_API_TOKEN` | yes (to send) | Token from step 2 |
| `EMAIL_FROM` | no | Defaults to `noreply@isbabyoutyet.com` |
| `EMAIL_FROM_PREVIEW` | no | Defaults to `preview@isbabyoutyet.com` |

Without the two Cloudflare credentials, production/preview password-reset
requests fail with a clear "Email Service is not configured" error. Local
`pnpm dev` never needs them — it logs the rendered message to the Convex
function log instead.

### 4. Redeploy

Push a commit or redeploy the latest preview/production deployment so
`deploy-convex.ts` syncs the env vars and the auth hooks pick them up.

### 5. Smoke-test

1. On a Vercel preview, open `/auth/forgot-password`.
2. Request a reset for a seeded account (`test@example.com`).
3. Confirm the inbox message:
   - From: `Is Baby Out Yet? (Preview) <preview@isbabyoutyet.com>`
   - Subject starts with `[Preview]`
   - Link points at that preview host's `/auth/reset-password`
4. Repeat on production and confirm the from address is
   `noreply@isbabyoutyet.com` with no subject prefix.

## Local development

No Cloudflare setup is required. Triggering a password reset writes a
structured `email.skipped_local_delivery` log line (to, from, subject, text)
in the Convex backend logs.

## Architecture notes

| Piece | Role |
| --- | --- |
| `emailSender.ts` | Port + log/Cloudflare adapters + identity resolution |
| `emailTemplates.ts` | Password-reset subject/text/html |
| `cloudflareEmail.ts` | Better Auth `sendResetPassword` entrypoint |
| Auth UI adapters | Same injectable-adapter pattern as login/signup |

Convex calls Cloudflare over HTTPS because Better Auth runs in Convex, not in
a Worker where an `env.EMAIL` binding would be available.
