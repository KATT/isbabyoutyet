import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { FormGuardProvider, useFormGuard } from "@/components/Form";
import { UpdateComposer } from "@/components/baby/timeline";
import { useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { allKeyed } from "@workspace/query-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import { FORBIDDEN } from "@workspace/convex/src/types";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { useRef } from "react";
import { useI18n } from "@/lib/i18n";
import { authenticateManagerOverlaySsr } from "@/lib/managerOverlayAuth";
import { useBabyPostOverlayNav } from "@/lib/overlay-nav";
import { managerDocToBabyData } from "@/routes/baby/$publicId/route";

export const Route = createFileRoute("/baby/$publicId/post")({
  beforeLoad: async (opts) => {
    const token = await authenticateManagerOverlaySsr(opts.context);
    return token ? { isAuthenticated: true, token } : undefined;
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
      throw notFound();
    }
    // oxlint-disable-next-line workspace/use-loader-preloads -- The authorized snapshot must remain stable while client auth reconnects.
    return data;
  },
  component: BabyPostUpdateOverlay,
});

export function BabyPostUpdateOverlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const completeOnboardingStep = useCompleteOnboardingStep();
  const { t } = useI18n();
  const post = useBabyPostOverlayNav(params.publicId);
  const formOverlay = useFormGuard({ onOpenChange: post.onOpenChange });
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
      {...formOverlay.rootProps}
      onOpenChangeComplete={post.onOpenChangeComplete}
    >
      <DialogContent className="sm:max-w-lg" initialFocus={contentRef} ref={contentRef}>
        <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
        <FormGuardProvider guard={formOverlay}>
          <UpdateComposer
            baby={baby}
            babyId={managerBabyDoc._id}
            babyName={managerBabyDoc.name}
            onPosted={() => {
              void completeOnboardingStep({ stepId: "post_update" });
              post.close();
            }}
          />
        </FormGuardProvider>
      </DialogContent>
    </Dialog>
  );
}
