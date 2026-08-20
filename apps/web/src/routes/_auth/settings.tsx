import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";

export const Route = createFileRoute("/_auth/settings")({
  validateSearch: z.object({
    baby: z.string().optional(),
  }),
  beforeLoad: (opts) => {
    if (!opts.search.baby) {
      throw redirect({ to: "/dashboard" });
    }
    throw redirect({
      to: "/baby/$publicId/settings",
      params: { publicId: opts.search.baby },
      replace: true,
    });
  },
});
