import { getThemePrimaryColor } from "@/components/baby/utils";
import { translate } from "@/lib/i18n";
import type { SupportedLocale } from "@workspace/convex/src/i18n";

export type BabyWebAppManifestInput = {
  _id: string;
  publicId: string;
  name: string;
  resolvedLocale: SupportedLocale;
  theme: string | null;
};

/**
 * Per-baby web app manifest. `id` is the Convex document id so an installed PWA
 * stays the same app when `publicId` rotates (rename). `start_url` / `scope`
 * stay on the shareable publicId so the page visitors install from is in-scope.
 */
export function babyWebAppManifest(baby: BabyWebAppManifestInput) {
  const locale = baby.resolvedLocale;
  const name = translate(locale, "Is {{name}} out yet?", { name: baby.name });
  const startUrl = `/baby/${baby.publicId}`;

  return {
    name,
    short_name: name,
    id: `/baby/${baby._id}`,
    start_url: startUrl,
    scope: startUrl,
    lang: locale,
    description: translate(locale, "Track {{name}}'s journey – know when baby arrives!", {
      name: baby.name,
    }),
    display: "standalone",
    theme_color: getThemePrimaryColor(baby.theme),
    background_color: "#0f172a",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "64x64 32x32 24x24 16x16",
        type: "image/x-icon",
      },
      {
        src: "/android-chrome-192x192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/android-chrome-512x512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
