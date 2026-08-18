import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/convex/convex/_generated/api";
import { createBabyOgImage } from "@/lib/og-image";

export const Route = createFileRoute("/og/baby/$publicId")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convexUrl = import.meta.env.VITE_CONVEX_URL;
        if (!convexUrl) {
          return new Response("VITE_CONVEX_URL not set", { status: 500 });
        }

        const client = new ConvexHttpClient(convexUrl);
        const baby = await client.query(api.baby.getByPublicId, {
          id: params.publicId,
        });

        if (!baby) {
          return new Response("Baby not found", { status: 404 });
        }

        return createBabyOgImage({
          name: baby.name,
          dueDate: baby.dueDate,
          theme: baby.theme,
          locale: baby.resolvedLocale,
          babyBorn: baby.babyBorn,
          wentToHospital: baby.wentToHospital,
          laborStarted: baby.laborStarted,
          milestoneVisibility: baby.milestoneVisibility,
          photoUrl: baby.photoUrl ?? baby.thumbnailUrl ?? null,
        });
      },
    },
  },
});
