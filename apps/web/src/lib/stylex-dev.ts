/**
 * StyleX unplugin serves aggregated CSS at `/virtual:stylex.css` in Vite
 * serve mode. TanStack Start SSR does not run Vite's `transformIndexHtml`,
 * so the plugin cannot auto-inject the stylesheet / HMR runtime — load the
 * runtime from a client module instead (see unplugin README).
 *
 * Production builds append StyleX CSS into a bundled CSS asset via
 * `generateBundle`; this module is a no-op there.
 */

/** @internal Keeps this file a module under `noUncheckedSideEffectImports`. */
export const stylexDevRuntimeLoaded = true;

if (import.meta.env.DEV) {
  void import("virtual:stylex:runtime");
}
