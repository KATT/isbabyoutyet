import { Dialog, DialogContent, DialogTitle } from "@workspace/ui/components/dialog";
import { UpdateComposer } from "@/components/baby/timeline";
import { useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { allKeyed } from "@workspace/query-prefetch";
import { api } from "@workspace/convex/convex/_generated/api";
import type { Id } from "@workspace/convex/convex/_generated/dataModel";
import { FORBIDDEN } from "@workspace/convex/src/types";
import type { BabyData } from "@workspace/convex/src/types";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { ReactNode } from "react";
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

type ManagerBabyDoc = Exclude<FunctionReturnType<typeof api.baby.getManagerBaby>, typeof FORBIDDEN>;

type ComposerSlotOpts = {
  babyId: Id<"baby">;
  baby: BabyData;
  babyName: string;
  onPosted: () => void;
};

export type BabyPostUpdateOverlayViewProps = {
  publicId: string;
  managerBabyDoc: ManagerBabyDoc;
  completeOnboardingStep: (args: { stepId: "post_update" }) => void | Promise<void>;
  /** Injected so tests can stub the composer without `vi.mock`. */
  renderComposer: (opts: ComposerSlotOpts) => ReactNode;
};

/**
 * Presentational post-update overlay. Takes injected onboarding + composer so
 * route tests exercise dialog / overlay-nav wiring without Convex mutations.
 */
export function BabyPostUpdateOverlayView(props: BabyPostUpdateOverlayViewProps) {
  const { t } = useI18n();
  const post = useBabyPostOverlayNav(props.publicId);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const baby = managerDocToBabyData(props.managerBabyDoc);

  return (
    <Dialog
      open={post.open}
      onOpenChange={post.onOpenChange}
      onOpenChangeComplete={post.onOpenChangeComplete}
    >
      <DialogContent ref={contentRef} initialFocus={contentRef} className="sm:max-w-lg">
        <DialogTitle className="sr-only">{t("Post an update")}</DialogTitle>
        {props.renderComposer({
          babyId: props.managerBabyDoc._id,
          baby,
          babyName: props.managerBabyDoc.name,
          onPosted: () => {
            void props.completeOnboardingStep({ stepId: "post_update" });
            post.close();
          },
        })}
      </DialogContent>
    </Dialog>
  );
}

export function BabyPostUpdateOverlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const completeOnboardingStep = useCompleteOnboardingStep();
  const managerBabyDoc =
    loaderData.managerBaby.initialData === FORBIDDEN ? null : loaderData.managerBaby.initialData;
  if (!managerBabyDoc) {
    throw notFound();
  }

  return (
    <BabyPostUpdateOverlayView
      publicId={params.publicId}
      managerBabyDoc={managerBabyDoc}
      completeOnboardingStep={(args) => {
        void completeOnboardingStep(args);
      }}
      renderComposer={(opts) => <UpdateComposer {...opts} />}
    />
  );
}
