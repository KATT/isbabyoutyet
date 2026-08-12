# @workspace/ui — vendored shadcn registry components

This package holds only the shadcn/ui components the app actually uses.
Unused components were deliberately deleted — knip (`pnpm knip`, part of
`pnpm checks`) fails CI on any component or export that nothing imports.

## Need a component that isn't here? Just install it.

**You are free to install any component from the shadcn registry at your own
discretion** — no permission needed. A component being absent from
`src/components/` does not mean it is unwanted; it just wasn't used yet.

```sh
cd packages/ui
pnpm dlx shadcn@latest add <component-name>
```

(The registry style and aliases are configured in `components.json`.)

Guidelines:

- Install whenever a task calls for a component this package lacks —
  re-adding is cheap and the registry is the source of truth.
- Actually use what you install (import it from `apps/web`), otherwise the
  knip gate will flag it as unused and fail `pnpm checks`.
- If a kept component is missing a subcomponent you need (some unused ones
  were trimmed, e.g. `CardAction`), re-add the whole component from the
  registry the same way — then keep the parts you use.
- New components may pull in new dependencies for this package; that's fine,
  knip verifies they're used.
