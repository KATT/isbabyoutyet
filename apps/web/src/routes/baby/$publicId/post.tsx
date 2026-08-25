import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { UpdateComposer } from "@/components/baby/timeline";
import { useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { allKeyed } from "@workspace/query-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { authenticateManagerOverlaySsr } from "@/lib/managerOverlayAuth";
import { useBabyPostOverlayNav } from "@/lib/overlay-nav";
import { managerDocToBabyData } from "@/routes/baby/$publicId/route";

export const Route = createFileRoute("/baby/$publicId/post")({
  beforeLoad: async (opts) => {
    const token = await authenticateManagerOverlaySsr(opts.context);
    if (typeof window === "undefined" && !token) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: opts.params.publicId },
        resetScroll: false,
      });
    }

    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId/post",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
    return token ? { token, isAuthenticated: true } : undefined;
  },
  loader: async (opts) => {
    const babyRef = opts.params.publicId;
    const data = await allKeyed({
      managerBaby: opts.context.convexPreloader.ensureQueryData(api.baby.getManagerBaby, {
        babyId: babyRef,
      }),
      myAccess: opts.context.convexPreloader.ensureQueryData(api.coParents.myAccess, {
        babyId: babyRef,
      }),
    });
    if (!data.myAccess.initialData.canManage || data.managerBaby.initialData === FORBIDDEN) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: babyRef },
        resetScroll: false,
      });
    }
    // oxlint-disable-next-line query-prefetch/use-loader-preloads -- The authorized snapshot must remain stable while client auth reconnects.
    return data;
  },
  component: BabyPostUpdateOverlay,
});

export function BabyPostUpdateOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const completeOnboardingStep = useCompleteOnboardingStep();
  const post = useBabyPostOverlayNav(params.publicId);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const managerBabyDoc =
    loaderData.managerBaby.initialData === FORBIDDEN ? null : loaderData.managerBaby.initialData;
  if (!managerBabyDoc) {
    throw notFound();
  }
  const baby = managerDocToBabyData(managerBabyDoc);

  return (
    <Dialog
      open={post.open}
      onOpenChange={post.onOpenChange}
      onOpenChangeComplete={post.onOpenChangeComplete}
    >
      <DialogContent ref={contentRef} initialFocus={contentRef} className="sm:max-w-lg">
        <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
        <UpdateComposer
          babyId={managerBabyDoc._id}
          baby={baby}
          babyName={managerBabyDoc.name}
          onPosted={() => {
            void completeOnboardingStep({ stepId: "post_update" });
            post.close();
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
