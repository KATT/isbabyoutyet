import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/manifest")({
  server: {
    handlers: {
      GET: ({ request }) => {
        const url = new URL(request.url);
        const startUrl = url.searchParams.get("start_url") || "/";
        const name = url.searchParams.get("name") || "Is Baby Out Yet?";
        const themeColor = url.searchParams.get("theme_color") || "#ea580c";

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
