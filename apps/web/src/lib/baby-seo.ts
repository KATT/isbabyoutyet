import { api } from "@workspace/convex/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { babySeoHead } from "@/lib/seo";

type PublicBabyDoc = NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>;

export function getBabySeo(doc: PublicBabyDoc, routePublicId: string) {
  return babySeoHead({
    name: doc.name,
    ...(doc.dueDateDisplayMode === "exact"
      ? { dueDateDisplayMode: "exact" as const, dueDate: doc.dueDate }
      : {
          dueDateDisplayMode: "message" as const,
          publicDueDateText: doc.publicDueDateText,
        }),
    // beforeLoad canonicalizes this route parameter. During same-route
    // navigation, reactive query data can briefly belong to the prior slug.
    publicId: routePublicId,
    theme: doc.theme,
    locale: doc.resolvedLocale,
    timeZone: doc.timeZone,
    babyBorn: doc.babyBorn,
    wentToHospital: doc.wentToHospital,
    laborStarted: doc.laborStarted,
    milestoneVisibility: doc.milestoneVisibility,
    photoId: doc.photoId ?? null,
  });
}
