import { defineConfig } from "vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig({
  plugins: [
    devtools(),
    // Keep the Nitro SSR service in one chunk. With Base UI, Rolldown otherwise
    // splits it into circular chunks and drops `ssr_exports`, which makes Vercel
    // previews return 500 (`Export 'ssr_exports' is not defined in module`).
    nitro({
      inlineDynamicImports: true,
      // Temporarily surface the real SSR error on previews while we verify the fix.
      errorHandler: "./src/ssr-error-handler.ts",
    }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
  ssr: {
    noExternal: ["@convex-dev/better-auth"],
  },
});

export default config;
