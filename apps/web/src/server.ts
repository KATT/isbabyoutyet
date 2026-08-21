import handler, { createServerEntry } from "@tanstack/react-start/server-entry";
import { appendFile } from "node:fs/promises";
import { paraglideMiddleware } from "./paraglide/server.js";

export default createServerEntry({
  async fetch(request) {
    // #region agent log
    if (
      process.env.NODE_ENV !== "production" &&
      request.method === "POST" &&
      new URL(request.url).pathname === "/_agent-debug"
    ) {
      const entry: unknown = await request.json();
      await appendFile("/opt/cursor/logs/debug.log", `${JSON.stringify(entry)}\n`);
      return new Response(null, { status: 204 });
    }
    // #endregion
    return paraglideMiddleware(request, () => handler.fetch(request));
  },
});
