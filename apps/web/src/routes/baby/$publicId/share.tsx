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
import { toast } from "sonner";
import { useCompleteOnboardingStep } from "@/components/onboarding/onboarding-host";
import { getBabySeo } from "@/lib/baby-seo";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useBabyShareOverlayNav } from "@/lib/overlay-nav";
import { babyOgImageUrl } from "@/lib/seo";
import { canonicalUrl } from "@/lib/site-url";
import { useTransientFlag } from "@/lib/use-transient-flag";
import * as stylex from "@stylexjs/stylex";
import { Text } from "@workspace/ui-patterns/components/text";

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

const styles = stylex.create({
  previewImage: {
    aspectRatio: "1200 / 630",
    objectFit: "cover",
    width: "100%",
  },
  linkText: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  fullWidth: {
    width: "100%",
  },
  clamp2: {
    display: "-webkit-box",
    overflow: "hidden",
    WebkitBoxOrient: "vertical",
    WebkitLineClamp: 2,
  },
});

export function BabyShareOverlay() {
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const completeOnboardingStep = useCompleteOnboardingStep();
  const { t } = useI18n();
  const [copied, showCopied] = useTransientFlag(2000);
  const share = useBabyShareOverlayNav(params.publicId);
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

  async function copyShareLink() {
    try {
      await navigator.clipboard.writeText(loaderData.shareLink);
      showCopied();
      toast.success(t("Copied to clipboard"));
      if (myAccessQuery.data.canManage) {
        void completeOnboardingStep({ stepId: "share_link" });
      }
    } catch {
      const textArea = document.createElement("textarea");
      textArea.value = loaderData.shareLink;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      try {
        document.execCommand("copy");
        showCopied();
        toast.success(t("Copied to clipboard"));
        if (myAccessQuery.data.canManage) {
          void completeOnboardingStep({ stepId: "share_link" });
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("Share the Link")}</DialogTitle>
          <DialogDescription>{t("This is how your page will look when shared.")}</DialogDescription>
        </DialogHeader>
        <Card>
          <img
            src={sharePreview.imageUrl}
            alt={sharePreview.title}
            width={1200}
            height={630}
            {...stylex.props(styles.previewImage)}
          />
          <CardHeader>
            <div {...stylex.props(styles.clamp2)}>
              <CardTitle>{sharePreview.title}</CardTitle>
            </div>
            <div {...stylex.props(styles.clamp2)}>
              <CardDescription>{sharePreview.description}</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <Text size="xs" tone="muted" truncate>
              {loaderData.shareLink}
            </Text>
          </CardContent>
          <CardFooter>
            <div {...stylex.props(styles.fullWidth)}>
            <Button
              onClick={() => {
                void copyShareLink();
              }}
            >
              {copied ? <CheckCircle data-icon="inline-start" /> : null}
              {copied ? t("Copied!") : t("Copy link to share")}
            </Button>
            </div>
          </CardFooter>
        </Card>
      </DialogContent>
    </Dialog>
  );
}
