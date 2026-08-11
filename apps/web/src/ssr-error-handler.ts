import type { NitroErrorHandler } from "nitro/types";

/**
 * Temporary preview debug handler: include the real error message so we can
 * diagnose Vercel SSR 500s. Remove once previews are healthy again.
 */
const errorHandler: NitroErrorHandler = async function ssrErrorHandler(error) {
  const message = error instanceof Error ? error.message : String(error);
  const cause =
    error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined;
  const stack = error instanceof Error ? error.stack : undefined;
  console.error("[ssr-error-handler]", message, cause, stack);
  return Response.json(
    {
      error: true,
      status: 500,
      unhandled: true,
      message,
      cause,
      stack,
    },
    { status: 500 },
  );
};

export default errorHandler;
