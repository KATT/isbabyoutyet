import { PhotoLightbox } from "@/components/baby/photo-lightbox";
import { browserImageFactory, prefetchBrowserImage } from "@/lib/image-prefetch";
import { useI18n } from "@/lib/i18n";
import { useBabyUpdatePhotoOverlayNav } from "@/lib/overlay-nav";
import { api } from "@workspace/convex/convex/_generated/api";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { preloadedQueryOptions } from "@workspace/query-prefetch";

export const Route = createFileRoute("/baby/$publicId/updates/$updateId/photo")({
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
        params: { publicId: babyDoc.publicId, updateId: opts.params.updateId },
        replace: true,
        to: "/baby/$publicId/updates/$updateId/photo",
      });
    }
  },
  loader: async (opts) => {
    const updatePhoto = await opts.context.convexPreloader.ensureQueryData(
      api.timeline.getUpdatePhoto,
      {
        babyId: opts.params.publicId,
        updateId: opts.params.updateId,
      },
    );
    if (!updatePhoto.initialData) {
      throw redirect({
        params: { publicId: opts.params.publicId },
        resetScroll: false,
        to: "/baby/$publicId",
      });
    }
    const imagePrefetch = prefetchBrowserImage(
      opts.context.queryClient,
      updatePhoto.initialData.photoUrl,
    );
    // oxlint-disable-next-line workspace/use-loader-preloads -- Snapshot must stay stable while the lightbox is open.
    return {
      imagePrefetch,
      updatePhoto,
    };
  },
  component: BabyUpdatePhotoOverlay,
});

export function BabyUpdatePhotoOverlay() {
  const { t } = useI18n();
  const params = Route.useParams();
  const loaderData = Route.useLoaderData();
  const photo = useBabyUpdatePhotoOverlayNav({
    publicId: params.publicId,
    updateId: params.updateId,
  });
  useQuery(preloadedQueryOptions(browserImageFactory, loaderData.imagePrefetch));
  const updatePhoto = loaderData.updatePhoto.initialData;
  if (!updatePhoto) {
    throw notFound();
  }

  return (
    <PhotoLightbox
      alt={t("Photo of {{name}}", { name: updatePhoto.babyName })}
      blurDataUrl={updatePhoto.blurDataUrl}
      overlay={photo}
      photoUrl={updatePhoto.photoUrl}
    />
  );
}
