import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/convex/convex/_generated/api";
import { getBabySeo } from "@/lib/baby-seo";
import { createBabyOgImage } from "@/lib/og-image";
import { withVersionedImageCache } from "@/lib/cachePolicy";
import { ALL_BABY_PAGES_CACHE_TAG, babyPublicIdCacheTag } from "@workspace/convex/src/cacheTags";

export const Route = createFileRoute("/og/baby/$publicId")({
  server: {
    handlers: {
      GET: async (opts) => {
        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        if (!convexUrl) {
          return new Response("VITE_CONVEX_URL not set", { status: 500 });
        }

        const client = new ConvexHttpClient(convexUrl);
        const baby = await client.query(api.baby.getByPublicId, {
          id: opts.params.publicId,
        });

        if (!baby) {
          return new Response("Baby not found", { status: 404 });
        }

        const requestUrl = new URL(opts.request.url);
        const requestedVersion = requestUrl.searchParams.get("v");
        const currentImageUrl = new URL(getBabySeo(baby, opts.params.publicId).imageUrl);
        const currentVersion = currentImageUrl.searchParams.get("v");
        if (currentVersion && requestedVersion !== currentVersion) {
          requestUrl.searchParams.set("v", currentVersion);
          return new Response(null, {
            status: 307,
            headers: {
              "Cache-Control": "no-store",
              "Vercel-CDN-Cache-Control": "private, no-store",
              Location: requestUrl.toString(),
            },
          });
        }

        return withVersionedImageCache(
          await createBabyOgImage({
            name: baby.name,
            ...(baby.dueDateDisplayMode === "exact"
              ? { dueDateDisplayMode: "exact" as const, dueDate: baby.dueDate }
              : {
                  dueDateDisplayMode: "message" as const,
                  publicDueDateText: baby.publicDueDateText,
                }),
            theme: baby.theme,
            locale: baby.resolvedLocale,
            timeZone: baby.timeZone,
            babyBorn: baby.babyBorn,
            wentToHospital: baby.wentToHospital,
            laborStarted: baby.laborStarted,
            milestoneVisibility: baby.milestoneVisibility,
            photoUrl: baby.photoUrl ?? baby.thumbnailUrl ?? null,
          }),
          [ALL_BABY_PAGES_CACHE_TAG, babyPublicIdCacheTag(opts.params.publicId)],
        );
      },
    },
  },
});
