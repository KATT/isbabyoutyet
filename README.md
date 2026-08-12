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

## deployment

- [Cloudflare Workers parallel deployment](docs/cloudflare.md)
