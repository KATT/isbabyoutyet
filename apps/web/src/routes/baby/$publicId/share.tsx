import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@workspace/ui/components/dialog";
import { CheckCircle } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { api } from "@workspace/convex/convex/_generated/api";
import { usePreloadedConvexQuery } from "@workspace/convex-prefetch";
import { allKeyed, preloadedQueryOptions } from "@workspace/query-prefetch";
import { useState } from "react";
import { toast } from "sonner";
import { useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { getBabySeo } from "@/lib/baby-seo";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useBabyShareOverlayNav } from "@/lib/overlay-nav";
import { babyOgImageUrl } from "@/lib/seo";
import { canonicalUrl } from "@/lib/site-url";

export const Route = createFileRoute("/baby/$publicId/share")({
  beforeLoad: async (opts) => {
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc) {
      throw notFound();
    }
    if (babyDoc.publicId !== opts.params.publicId) {
      throw redirect({
        to: "/baby/$publicId/share",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
  },
  loader: async (opts) => {
    const publicId = opts.params.publicId;
    const imageUrl = babyOgImageUrl(publicId, undefined);
    const data = await allKeyed({
      baby: opts.context.convexPreloader.fetchQueryData(api.baby.getByPublicId, {
        id: publicId,
      }),
      myAccess: opts.context.convexPreloader.ensureQueryData(api.coParents.myAccess, {
        babyId: publicId,
      }),
    });
    const babyDoc = data.baby.initialData;
    const sharePreview = babyDoc ? getBabySeo(babyDoc, publicId) : null;
    // The browser image identity depends on the fetched public baby fields.
    const imagePrefetch = prefetchBrowserImage(
      opts.context.queryClient,
      sharePreview?.imageUrl ?? imageUrl,
    );

    return {
      baby: data.baby,
      imagePrefetch,
      myAccess: data.myAccess,
      shareLink: canonicalUrl(`/baby/${publicId}`),
    };
  },
  component: BabyShareOverlay,
});

export type BabyShareOverlayViewProps = {
  publicId: string;
  shareLink: string;
  sharePreview: {
    imageUrl: string;
    title: string;
    description: string;
  };
  canManage: boolean;
  completeOnboardingStep: (args: { stepId: "share_link" }) => void | Promise<void>;
};

/**
 * Presentational share overlay. Query wiring stays in the route component so
 * tests can drive copy + dismiss without Convex/`vi.mock`.
 */
export function BabyShareOverlayView(props: BabyShareOverlayViewProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const share = useBabyShareOverlayNav(props.publicId);

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(props.shareLink);
      setCopied(true);
      toast.success(t("Copied to clipboard"));
      if (props.canManage) {
        void props.completeOnboardingStep({ stepId: "share_link" });
      }
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = props.shareLink;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        toast.success(t("Copied to clipboard"));
        if (props.canManage) {
          void props.completeOnboardingStep({ stepId: "share_link" });
        }
      } catch (cause) {
        toast.error(
          "Failed to copy to clipboard: " +
            (cause instanceof Error ? cause.message : "Unknown error"),
        );
      }
      document.body.removeChild(textArea);
    }
  }

  return (
    <Dialog
      open={share.open}
      onOpenChange={share.onOpenChange}
      onOpenChangeComplete={share.onOpenChangeComplete}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("Share the Link")}</DialogTitle>
          <DialogDescription>{t("This is how your page will look when shared.")}</DialogDescription>
        </DialogHeader>
        <Card>
          <img
            src={props.sharePreview.imageUrl}
            alt={props.sharePreview.title}
            width={1200}
            height={630}
            className="aspect-[1200/630] w-full object-cover"
          />
          <CardHeader>
            <CardTitle className="line-clamp-2">{props.sharePreview.title}</CardTitle>
            <CardDescription className="line-clamp-2">
              {props.sharePreview.description}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="truncate text-xs text-muted-foreground">{props.shareLink}</p>
          </CardContent>
          <CardFooter>
            <Button
              className="w-full"
              onClick={() => {
                void copyShareLink();
              }}
            >
              {copied ? <CheckCircle data-icon="inline-start" /> : null}
              {copied ? t("Copied!") : t("Copy link to share")}
            </Button>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}

export function BabyShareOverlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const completeOnboardingStep = useCompleteOnboardingStep();
  const babyQuery = usePreloadedConvexQuery(api.baby.getByPublicId, loaderData.baby);
  const myAccessQuery = usePreloadedConvexQuery(api.coParents.myAccess, loaderData.myAccess);
  const babyDoc = babyQuery.data;
  const sharePreview = babyDoc ? getBabySeo(babyDoc, params.publicId) : null;
  useQuery(
    preloadedQueryOptions(browserImageFactory, loaderData.imagePrefetch, () => {
      return (
        sharePreview?.imageUrl ??
        loaderData.imagePrefetch.input ??
        babyOgImageUrl(params.publicId, undefined)
      );
    }),
  );
  if (!sharePreview) {
    throw notFound();
  }

  return (
    <BabyShareOverlayView
      publicId={params.publicId}
      shareLink={loaderData.shareLink}
      sharePreview={sharePreview}
      canManage={myAccessQuery.data.canManage}
      completeOnboardingStep={(args) => {
        void completeOnboardingStep(args);
      }}
    />
  );
}
