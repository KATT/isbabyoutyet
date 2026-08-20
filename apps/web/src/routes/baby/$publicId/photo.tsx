import { PhotoLightbox } from "@/components/baby/photo-lightbox";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useOverlayNav } from "@/lib/overlay-nav";
import { api } from "@workspace/convex/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { preloadedQueryOptions } from "@workspace/query-prefetch";

export const Route = createFileRoute("/baby/$publicId/photo")({
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
        to: "/baby/$publicId/photo",
        params: { publicId: babyDoc.publicId },
        replace: true,
      });
    }
  },
  loader: async (opts) => {
    const baby = await opts.context.convexPreloader.ensureQueryData(api.baby.getByPublicId, {
      id: opts.params.publicId,
    });
    const babyDoc = baby.initialData;
    if (!babyDoc?.photoUrl) {
      throw redirect({
        to: "/baby/$publicId",
        params: { publicId: opts.params.publicId },
        resetScroll: false,
      });
    }
    const imagePrefetch = prefetchBrowserImage(opts.context.queryClient, babyDoc.photoUrl);
    // oxlint-disable-next-line query-prefetch/use-loader-preloads -- Snapshot must stay stable while the lightbox is open.
    return {
      baby,
      imagePrefetch,
    };
  },
  component: BabyPhotoOverlay,
});

export function BabyPhotoOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  useQuery(preloadedQueryOptions(browserImageFactory, loaderData.imagePrefetch));
  const babyDoc = loaderData.baby.initialData;
  if (!babyDoc?.photoUrl) {
    throw notFound();
  }
  const photo = useOverlayNav({
    open: {
      to: "/baby/$publicId/photo",
      params: { publicId: params.publicId },
    },
    close: {
      to: "/baby/$publicId",
      params: { publicId: params.publicId },
    },
  });

  return (
    <PhotoLightbox
      photoUrl={babyDoc.photoUrl}
      blurDataUrl={babyDoc.blurDataUrl ?? null}
      alt={t("Photo of {{name}}", { name: babyDoc.name })}
      onDismiss={photo.dismiss}
    />
  );
}
