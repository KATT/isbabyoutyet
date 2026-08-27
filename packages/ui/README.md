# `@workspace/ui`

StyleX + Base UI components from [shadcn-cssinjs](https://www.shadcn-cssinjs.com/docs).

## Theming

Tokens in `src/lib/tokens.stylex.ts` map to CSS variables in
`src/styles/globals.css` (`--primary`, `--background`, …). Dark mode stays
`next-themes` + `.dark` on the document. App layout may still use Tailwind
utilities from the same stylesheet; StyleX owns component chrome.

## Vite

`apps/web/vite.config.ts` uses `@stylexjs/unplugin` so StyleX in this package
is compiled and CSS is aggregated into the app stylesheet.

## Adding components

```bash
cd packages/ui
pnpm dlx shadcn@latest add @stylex/button
```

Or install from the registry URL and rewrite `@/` imports to
`@workspace/ui/…`.

## Layout / spacing

For StyleX layout outside components, see `@workspace/ui-patterns`.
