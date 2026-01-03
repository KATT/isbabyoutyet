import { createFileRoute } from "@tanstack/react-router";
import { authServer } from "@/lib/auth-server";

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: ({ request }) => authServer.handler(request),
      POST: ({ request }) => authServer.handler(request),
    },
  },
});
