# `@workspace/ui-cssinjs`

StyleX + Base UI components from [shadcn-cssinjs](https://www.shadcn-cssinjs.com/docs),
installed **in parallel** with `@workspace/ui` (Tailwind shadcn).

## Theming

Tokens in `src/lib/tokens.stylex.ts` map to the same CSS variables as
`@workspace/ui` (`--primary`, `--background`, …). Dark mode stays
`next-themes` + `.dark` on the document.

## Vite

`apps/web/vite.config.ts` uses `@stylexjs/unplugin` with
`externalPackages: ["@workspace/ui-cssinjs"]` so StyleX in this package is
compiled and CSS is aggregated into the app stylesheet.

## Adding components

```bash
cd packages/ui-cssinjs
pnpm dlx shadcn@latest add @stylex/button
```

Or install from the registry URL and rewrite `@/` imports to
`@workspace/ui-cssinjs/…`.

## Layout / spacing

App screens may keep Tailwind layout utilities during migration. For StyleX
layout outside components, see `@workspace/ui-patterns` (later in the stack).
