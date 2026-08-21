import { createFileRoute } from "@tanstack/react-router";
import { babyPageCacheHeaders } from "@/lib/cachePolicy";

export const Route = createFileRoute("/baby/$publicId/")({
  headers: (opts) => babyPageCacheHeaders(opts.params.publicId),
  component: BabyPageIndex,
});

export function BabyPageIndex() {
  return null;
}
