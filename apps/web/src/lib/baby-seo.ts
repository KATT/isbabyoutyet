import { api } from "@workspace/convex/convex/_generated/api";
import type { FunctionReturnType } from "convex/server";
import { babySeoHead } from "@/lib/seo";

type PublicBabyDoc = NonNullable<FunctionReturnType<typeof api.baby.getByPublicId>>;

export function getBabySeo(doc: PublicBabyDoc, routePublicId: string) {
  return babySeoHead({
    name: doc.name,
    ...(doc.dueDateDisplayMode === "exact"
      ? { dueDate: doc.dueDate, dueDateDisplayMode: "exact" as const }
      : {
          dueDateDisplayMode: "message" as const,
          publicDueDateText: doc.publicDueDateText,
        }),
    // beforeLoad canonicalizes this route parameter. During same-route
    // navigation, reactive query data can briefly belong to the prior slug.
    babyBorn: doc.babyBorn,
    laborStarted: doc.laborStarted,
    locale: doc.resolvedLocale,
    milestoneVisibility: doc.milestoneVisibility,
    photoId: doc.photoId ?? null,
    publicId: routePublicId,
    theme: doc.theme,
    timeZone: doc.timeZone,
    wentToHospital: doc.wentToHospital,
  });
}
