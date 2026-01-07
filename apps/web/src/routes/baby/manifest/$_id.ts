import { getThemePrimaryColor } from "@/components/baby/utils";
import { createFileRoute } from "@tanstack/react-router";
import { ConvexHttpClient } from "convex/browser";
import { api } from "@workspace/convex/convex/_generated/api";

export const Route = createFileRoute("/baby/manifest/$_id")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const convexUrl = process.env.VITE_CONVEX_URL;
        if (!convexUrl) {
          return new Response("VITE_CONVEX_URL not set", { status: 500 });
        }

        const client = new ConvexHttpClient(convexUrl);
        const baby = await client.query(api.baby.getByPublicId, {
          id: params._id,
        });

        if (!baby) {
          return new Response("Baby not found", { status: 404 });
        }

        const name = `Is ${baby.name} out yet?`;
        const themeColor = getThemePrimaryColor(baby.theme);
        const startUrl = `/baby/${baby._id}`;

        const manifest = {
          name,
          short_name: name,
          id: startUrl,
          start_url: startUrl,
          display: "standalone",
          theme_color: themeColor,
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

        return Response.json(manifest, {
          headers: {
            "Content-Type": "application/manifest+json",
          },
        });
      },
    },
  },
});
