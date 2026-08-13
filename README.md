mainly vibe coded

## dev setup

### install

```sh
pnpm install
```

### development

```sh
pnpm dev
```

Local and Vercel preview backends are seeded with a demo login:

- email: `test@example.com`
- password: `password`

That account owns babies in every status (waiting, labour, hospital, born). Re-run with `pnpm --filter @workspace/convex seed` (idempotent).

The homepage also links to a public live demo at `/baby/juniper` (seeded in every environment, including production). Production deploys refresh its dates and wipe visitor comments.

Demo photos live in Git LFS (`packages/convex/assets/homepage-demo/`). Vercel: enable Git LFS in the project Git settings so production/preview builds receive the actual images.
