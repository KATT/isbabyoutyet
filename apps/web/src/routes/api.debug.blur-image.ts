import { appendFileSync } from "node:fs";
import { createFileRoute } from "@tanstack/react-router";
import * as z from "zod";

const debugEntrySchema = z.object({
  hypothesisId: z.string(),
  location: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
});

export const Route = createFileRoute("/api/debug/blur-image")({
  server: {
    handlers: {
      POST: async (opts) => {
        const result = debugEntrySchema.safeParse(await opts.request.json());
        if (!result.success) {
          return new Response(null, { status: 400 });
        }

        // #region agent log
        appendFileSync("/opt/cursor/logs/debug.log", `${JSON.stringify(result.data)}\n`);
        // #endregion
        return new Response(null, { status: 204 });
      },
    },
  },
});
