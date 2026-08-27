import type { Plugin } from "vite";
import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import stylex from "@stylexjs/unplugin";
import { nitro } from "nitro/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";

/**
 * Base UI (and recharts, etc.) pull in `use-sync-external-store/shim`, a CJS-only
 * module. Vite/Rolldown SSR lowers its `require("react")` to a runtime
 * `createRequire` call. On Vercel that fails with `Cannot find module 'react'`
 * because the serverless function has no node_modules (nitrojs/nitro#4171,
 * rolldown#9407). React 19 already exports `useSyncExternalStore`, so alias the
 * basic shim to `react`.
 *
 * Do NOT alias `shim/with-selector` — that exports `useSyncExternalStoreWithSelector`,
 * which is not on the React package (client crash: "is not a function").
 */
function aliasUseSyncExternalStoreShim(): Plugin {
  return {
    name: "alias-use-sync-external-store-shim",
    enforce: "pre",
    config() {
      return {
        resolve: {
          alias: [
            {
              find: /^use-sync-external-store\/shim$/,
              replacement: "react",
            },
            {
              find: /^use-sync-external-store\/shim\/index\.js$/,
              replacement: "react",
            },
          ],
        },
      };
    },
  };
}

/**
 * `@resvg/resvg-js` loads a NAPI `.node` binary. Rolldown (Vite 8 dep
 * optimization + SSR) tries to parse that file as UTF-8 and crashes
 * (`UNLOADABLE_DEPENDENCY` / "stream did not contain valid UTF-8"). Keep the
 * package as a Node builtin-style require so OG PNG rendering still works.
 */
function skipNativeNodeAddons(): Plugin {
  return {
    name: "skip-native-node-addons",
    enforce: "pre",
    resolveId(source) {
      if (!source.endsWith(".node")) {
        return null;
      }
      return { id: source, external: true };
    },
  };
}

/**
 * Nitro's Vite dev middleware classifies every `Sec-Fetch-Dest: image`
 * request as a static asset before TanStack Start can dispatch extensionless
 * server routes. Keep generated `/og` images on the SSR path in development.
 */
function routeGeneratedImagesThroughSsr(): Plugin {
  return {
    name: "route-generated-images-through-ssr",
    enforce: "pre",
    configureServer(server) {
      server.middlewares.use((...args) => {
        const request = args[0];
        const next = args[2];
        const pathname = request.url?.split(/[?#]/, 1)[0];
        if (
          request.headers["sec-fetch-dest"] === "image" &&
          (pathname === "/og" || pathname?.startsWith("/og/"))
        ) {
          delete request.headers["sec-fetch-dest"];
        }
        next();
      });
    },
  };
}

/**
 * Belt-and-suspenders for any remaining leaked `__require("react")` after the
 * shim alias (same rewrite as discussed on nitro#4171).
 */
function patchLeakedReactRequire(): Plugin {
  return {
    name: "patch-leaked-react-require",
    enforce: "post",
    generateBundle(_options, bundle) {
      for (const chunk of Object.values(bundle)) {
        if (chunk.type !== "chunk" || !chunk.code.includes('__require("react")')) {
          continue;
        }
        const match = chunk.code.match(/\brequire_react(?:\$\d+)?\b/);
        if (!match) {
          continue;
        }
        chunk.code = chunk.code.replaceAll('__require("react")', `${match[0]}()`);
      }
    },
  };
}

const config = defineConfig({
  plugins: [
    // Docs require devtools() as the first Vite plugin:
    // https://tanstack.com/devtools/latest/docs/quick-start#vite-plugin
    devtools(),
    aliasUseSyncExternalStoreShim(),
    skipNativeNodeAddons(),
    routeGeneratedImagesThroughSsr(),
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
      outputStructure: "message-modules",
      emitTsDeclarations: true,
      cookieName: "PARAGLIDE_LOCALE",
      strategy: ["cookie", "preferredLanguage", "baseLocale"],
    }),
    // Base UI grows the Nitro SSR rebundle enough that Rolldown's default split
    // creates circular `ssr`/`ssr2` chunks and drops `ssr_exports` (preview 500).
    // Keep the SSR service graph in one chunk; still split real node_modules
    // into `_libs`. Avoid `inlineDynamicImports` — it worsens the leaked
    // `require('react')` failure on Vercel (nitro#4171).
    nitro({
      rolldownConfig: {
        output: {
          codeSplitting: {
            groups: [
              {
                name: "ssr",
                test: /[/\\]node_modules[/\\]\.nitro[/\\]vite[/\\]services[/\\]ssr[/\\]/,
              },
              {
                test: /node_modules[/\\](?!(?:nitro|nitro-nightly)[/\\])[^.]/,
                name(id: string) {
                  const match =
                    /[/\\]node_modules[/\\](?:\.pnpm[/\\][^/]+[/\\]node_modules[/\\])?(?:(@[^/]+[/\\][^/]+)|([^/]+))/i.exec(
                      id,
                    );
                  const name = match?.[1] ?? match?.[2];
                  return name ? name.replace(/[/\\+@]/g, "_") : "vendor";
                },
              },
            ],
          },
        },
      },
    }),
    patchLeakedReactRequire(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    // Compile StyleX in `@workspace/ui` (and the app) before React.
    stylex.vite({
      useCSSLayers: true,
      runtimeInjection: false,
    }),
    tanstackStart({
      server: {
        entry: "./src/server.ts",
      },
    }),
    viteReact({ compiler: true }),
  ],
  optimizeDeps: {
    exclude: ["@resvg/resvg-js"],
  },
  ssr: {
    noExternal: [
      "@convex-dev/better-auth",
      "@workspace/ui",
      "@workspace/ui-patterns",
      "@stylexjs/stylex",
    ],
    external: ["@resvg/resvg-js"],
    optimizeDeps: {
      exclude: ["@resvg/resvg-js"],
    },
  },
});

export default config;
