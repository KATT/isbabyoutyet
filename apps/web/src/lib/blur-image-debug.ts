import { appendFileSync } from "node:fs";
import { createServerFn } from "@tanstack/react-start";
import * as z from "zod";

const debugEntrySchema = z.object({
  hypothesisId: z.string(),
  location: z.string(),
  message: z.string(),
  data: z.record(z.string(), z.unknown()),
  timestamp: z.number(),
});

export const writeBlurImageDebug = createServerFn({ method: "POST" })
  .validator(debugEntrySchema)
  .handler((opts) => {
    // #region agent log
    appendFileSync("/opt/cursor/logs/debug.log", `${JSON.stringify(opts.data)}\n`);
    // #endregion
    return null;
  });
