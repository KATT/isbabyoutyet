import { babyWebAppManifest } from "@/lib/baby-manifest";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/convex/convex/_generated/api";

export const Route = createFileRoute("/baby/manifest/$_id")({
  server: {
    handlers: {
      GET: async (opts) => {
        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        if (!convexUrl) {
          return new Response("VITE_CONVEX_URL not set", { status: 500 });
        }

        const client = new ConvexHttpClient(convexUrl);
        const baby = await client.query(api.baby.getByPublicId, {
          id: opts.params._id,
        });

        if (!baby) {
          return new Response("Baby not found", { status: 404 });
        }

        return Response.json(
          babyWebAppManifest({
            _id: baby._id,
            publicId: baby.publicId,
            name: baby.name,
            resolvedLocale: baby.resolvedLocale,
            theme: baby.theme ?? null,
          }),
          {
            headers: {
              "Content-Type": "application/manifest+json",
            },
          },
        );
      },
    },
  },
});
