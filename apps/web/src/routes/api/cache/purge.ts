import { createFileRoute } from "@tanstack/react-router";
import { dangerouslyDeleteByTag } from "@vercel/functions";
import { deriveCachePurgeToken } from "@workspace/convex/src/cacheTags";
import * as z from "zod";

const purgeRequestSchema = z.object({
  tags: z.array(z.string().min(1).max(256)).min(1).max(16),
});

const PRIVATE_HEADERS = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
} as const;

export async function handleCachePurge(request: Request) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) {
    return Response.json(
      { error: "Cache purge is not configured" },
      {
        status: 503,
        headers: PRIVATE_HEADERS,
      },
    );
  }

  const expectedToken = await deriveCachePurgeToken(secret);
  if (request.headers.get("Authorization") !== `Bearer ${expectedToken}`) {
    return Response.json(
      { error: "Unauthorized" },
      {
        status: 401,
        headers: PRIVATE_HEADERS,
      },
    );
  }

  const parsed = purgeRequestSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid cache purge request" },
      {
        status: 400,
        headers: PRIVATE_HEADERS,
      },
    );
  }

  if (process.env.VERCEL) {
    await dangerouslyDeleteByTag(parsed.data.tags, {
      revalidationDeadlineSeconds: 0,
    });
  }

  return Response.json({ purged: true }, { headers: PRIVATE_HEADERS });
}

export const Route = createFileRoute("/api/cache/purge")({
  server: {
    handlers: {
      POST: async (requestContext) => {
        return await handleCachePurge(requestContext.request);
      },
    },
  },
});
